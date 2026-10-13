// Word-document (.docx) template for call scenarios: download a labelled template,
// parse an uploaded .docx/.txt back into the builder form, and export the current
// scenario as a .docx. The labelled line format keeps import STABLE (validated),
// unlike free-form text. Steps are linked by number (go to: 2 / go to: end).
// Docs are built/zipped with jszip (lazy-loaded); upload text comes from fileText.js.

export const CATEGORIES = ['Billing', 'Technical', 'Sales', 'Complaint', 'Account'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const MOODS = ['calm', 'confused', 'frustrated', 'irate'];

// The downloadable example — trainers edit the values, keep the labels.
export const TEMPLATE_LINES = [
  'VoiceLink — Call Scenario Template',
  'Fill in the values below. Keep the labels (Title:, Step 1, Customer:, Option:).',
  'Each option line: Option: <what the agent says> | score: 0-10 | go to: <step number or "end"> | feedback: <optional> | keywords: <optional, comma separated>',
  '',
  'Title: Billing dispute — double charge',
  'Category: Billing',
  'Difficulty: Easy',
  'Pass mark: 70',
  'Start step: 1',
  'Customer name: Maria Santos',
  'Customer mood: frustrated',
  'Customer issue: Charged twice for this month’s plan.',
  '',
  'Step 1',
  'Customer: I was charged twice this month and I want my money back!',
  'Option: I understand how frustrating that is. Let me verify your account first. | score: 10 | go to: 2 | feedback: Great empathy and verification. | keywords: verify, account',
  "Option: That can't happen on our system. | score: 2 | go to: 2 | feedback: Avoid dismissing the customer.",
  '',
  'Step 2',
  'Customer: Okay, my account number is 12345.',
  "Option: Thank you — I can see the duplicate charge and I'll process a refund now. | score: 10 | go to: end | feedback: Clear first-contact resolution.",
  "Option: I'll escalate this to another team, please call back later. | score: 4 | go to: end",
];

/* ---------------- Build a minimal .docx ---------------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const para = (text) => (text ? `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>` : '<w:p/>');

async function buildDocxBlob(lines) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '</Types>');
  zip.folder('_rels').file('.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>');
  zip.folder('word').file('document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    + lines.map(para).join('')
    + '<w:sectPr/></w:body></w:document>');
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export async function downloadScenarioDocx(lines, filename) {
  const blob = await buildDocxBlob(lines);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- Current form → template lines (export) ---------------- */
export function formToLines(form) {
  const num = {};
  form.steps.forEach((s, i) => { num[s.key] = i + 1; });
  const lines = [
    `Title: ${form.title}`,
    `Category: ${form.category}`,
    `Difficulty: ${form.difficulty}`,
    `Pass mark: ${form.passingScore}`,
    `Start step: ${num[form.startStep] || 1}`,
    `Customer name: ${form.customer.name}`,
    `Customer mood: ${form.customer.mood}`,
    `Customer issue: ${form.customer.issue}`,
  ];
  if (form.description) lines.splice(1, 0, `Description: ${form.description}`);
  form.steps.forEach((s, i) => {
    lines.push('', `Step ${i + 1}`, `Customer: ${s.customerLine}`);
    s.options.forEach((o) => {
      const parts = [`Option: ${o.text}`, `score: ${o.score}`, `go to: ${o.nextStep && num[o.nextStep] ? num[o.nextStep] : 'end'}`];
      if (o.feedback) parts.push(`feedback: ${o.feedback}`);
      if (o.keywordsText) parts.push(`keywords: ${o.keywordsText}`);
      lines.push(parts.join(' | '));
    });
  });
  return lines;
}

/* ---------------- Parse uploaded text → builder form (validate) ---------------- */
const canon = (value, allowed, label) => {
  const hit = allowed.find((a) => a.toLowerCase() === String(value || '').trim().toLowerCase());
  if (!hit) throw new Error(`"${label}" must be one of: ${allowed.join(', ')}. Got "${String(value).trim()}".`);
  return hit;
};

export function parseScenarioText(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const header = {};
  const steps = [];
  let cur = null;
  let startNum = 1;

  const headerLabel = (line) => {
    const m = line.match(/^(title|description|category|difficulty|pass ?mark|passing ?score|pass|start ?step|customer ?name|customer ?mood|customer ?issue)\s*:\s*(.*)$/i);
    if (!m) return false;
    header[m[1].toLowerCase().replace(/\s+/g, '')] = m[2].trim();
    return true;
  };

  for (const line of lines) {
    if (!line) continue;
    const stepM = line.match(/^step\s+(\d+)\b/i);
    if (stepM) { cur = { customerLine: '', options: [] }; steps.push(cur); continue; }
    if (cur) {
      const cM = line.match(/^customer\s*:\s*(.*)$/i);
      if (cM) { cur.customerLine = cM[1].trim(); continue; }
      const oM = line.match(/^option\s*:\s*(.+)$/i);
      if (oM) { cur.options.push(parseOption(oM[1], steps.length)); continue; }
      // any other line inside a step: ignore (instructions, blanks)
    } else {
      headerLabel(line); // header fields only count before the first Step
    }
  }

  if (!steps.length) throw new Error('No steps found. Keep the "Step 1", "Customer:" and "Option:" labels.');
  if (!header.title) throw new Error('Missing "Title:".');
  if (!header.customername) throw new Error('Missing "Customer name:".');
  if (!header.customerissue) throw new Error('Missing "Customer issue:".');

  const n = steps.length;
  const keys = steps.map((_, i) => `s${i + 1}`);
  const outSteps = steps.map((st, i) => {
    if (!st.customerLine) throw new Error(`Step ${i + 1}: add a "Customer:" line.`);
    if (st.options.length < 2 || st.options.length > 4) throw new Error(`Step ${i + 1}: needs 2-4 "Option:" lines (has ${st.options.length}).`);
    return {
      key: keys[i],
      customerLine: st.customerLine,
      options: st.options.map((o) => {
        let nextStep = '';
        if (o.goTo != null) {
          if (o.goTo < 1 || o.goTo > n) throw new Error(`Step ${i + 1}: "go to: ${o.goTo}" must be a step number 1-${n}, or "end".`);
          nextStep = keys[o.goTo - 1];
        }
        return { text: o.text, score: o.score, feedback: o.feedback, nextStep, keywordsText: o.keywords };
      }),
    };
  });

  startNum = parseInt(header.startstep, 10);
  if (!Number.isInteger(startNum) || startNum < 1 || startNum > n) startNum = 1;
  const passingScore = Math.min(Math.max(parseInt(header.passmark ?? header.passingscore ?? header.pass, 10) || 70, 1), 100);

  return {
    title: header.title,
    description: header.description || '',
    category: header.category ? canon(header.category, CATEGORIES, 'Category') : 'Billing',
    difficulty: header.difficulty ? canon(header.difficulty, DIFFICULTIES, 'Difficulty') : 'Easy',
    passingScore,
    customer: {
      name: header.customername,
      mood: header.customermood ? canon(header.customermood, MOODS, 'Customer mood') : 'calm',
      issue: header.customerissue,
    },
    startStep: keys[startNum - 1],
    steps: outSteps,
  };
}

function parseOption(raw, stepNo) {
  const parts = raw.split('|').map((p) => p.trim());
  const text = parts.shift();
  if (!text) throw new Error(`Step ${stepNo}: an "Option:" line is missing its text.`);
  const opt = { text, score: 5, feedback: '', goTo: null, keywords: '' };
  for (const p of parts) {
    const m = p.match(/^([a-z ]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].trim().toLowerCase().replace(/\s+/g, '');
    const v = m[2].trim();
    if (k === 'score') {
      const s = Number(v);
      if (!Number.isFinite(s) || s < 0 || s > 10) throw new Error(`Step ${stepNo}: option "score" must be 0-10 (got "${v}").`);
      opt.score = s;
    } else if (k === 'goto' || k === 'next' || k === 'nextstep') {
      opt.goTo = /^(end|none|-|)$/i.test(v) ? null : Number(v);
      if (opt.goTo !== null && !Number.isFinite(opt.goTo)) throw new Error(`Step ${stepNo}: "go to" must be a step number or "end" (got "${v}").`);
    } else if (k === 'feedback') {
      opt.feedback = v;
    } else if (k === 'keywords') {
      opt.keywords = v;
    }
  }
  return opt;
}
