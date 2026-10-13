// Split lesson Markdown into sections for the agent's section-by-section reader.
// A new section starts at each "## " heading. Any text before the first "## "
// becomes an intro section. Lessons with no "## " heading return a single section.
export function splitSections(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let cur = { heading: '', body: [] };
  let sawHeading = false;

  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line.trim());
    if (m) {
      if (sawHeading || cur.body.join('').trim()) sections.push(cur);
      cur = { heading: m[1].trim(), body: [] };
      sawHeading = true;
    } else {
      cur.body.push(line);
    }
  }
  sections.push(cur);

  const out = sections
    .map((s) => ({ heading: s.heading, content: s.body.join('\n').trim() }))
    .filter((s) => s.heading || s.content);

  return out.length ? out : [{ heading: '', content: String(markdown || '').trim() }];
}
