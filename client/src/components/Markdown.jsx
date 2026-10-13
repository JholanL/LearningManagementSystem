/**
 * Minimal, safe Markdown renderer for lesson/article content.
 * Supports: #/##/### headings, - / * bullet lists, 1. ordered lists, **bold**,
 * *italic*, `code`, [links](url), block images ![alt](url), a bare YouTube URL
 * on its own line (embedded as a video), and blank-line-separated paragraphs.
 * Everything is rendered as React children — no innerHTML, no XSS. URLs are
 * restricted to http(s) (and data:image for images) so javascript: can't sneak in.
 */
import { toYouTubeEmbed } from '../utils/helpers';

const safeHref = (url) => (/^https?:\/\//i.test(url || '') ? url : null);
const safeImg = (url) => (/^(https?:\/\/|data:image\/)/i.test(url || '') ? url : null);

// Parse inline **bold**, *italic*, `code`, [text](url) inside a line of text.
function inline(text, keyPrefix) {
  const nodes = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={`${keyPrefix}-b${k}`}>{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<em key={`${keyPrefix}-i${k}`}>{m[3]}</em>);
    else if (m[4] !== undefined) nodes.push(<code key={`${keyPrefix}-c${k}`}>{m[4]}</code>);
    else if (m[5] !== undefined) {
      const href = safeHref(m[6]);
      nodes.push(href
        ? <a key={`${keyPrefix}-l${k}`} href={href} target="_blank" rel="noopener noreferrer">{m[5]}</a>
        : m[5]);
    }
    last = m.index + m[0].length;
    k += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isHeading = (s) => /^#{1,6}\s+/.test(s.trim());
const isUl = (s) => /^\s*[-*]\s+/.test(s);
const isOl = (s) => /^\s*\d+\.\s+/.test(s);
const IMG_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const isVideoUrl = (s) => /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+$/i.test(s);

function VideoEmbed({ url, k }) {
  const embed = toYouTubeEmbed(url);
  if (embed) {
    return (
      <div key={k} className="ratio ratio-16x9 my-3 rounded overflow-hidden">
        <iframe src={embed} title="Lesson video" allow="encrypted-media; picture-in-picture" allowFullScreen style={{ border: 0 }} />
      </div>
    );
  }
  const href = safeHref(url);
  return href ? <p key={k}><a href={href} target="_blank" rel="noopener noreferrer"><i className="bi bi-box-arrow-up-right me-1" />Open video</a></p> : null;
}

export default function Markdown({ text = '' }) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i += 1; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      const level = Math.min(h[1].length + 2, 6);
      const Tag = `h${level}`;
      blocks.push(<Tag key={`h${i}`} className="fw-semibold mt-3 mb-2">{inline(h[2], `h${i}`)}</Tag>);
      i += 1;
      continue;
    }

    const img = IMG_RE.exec(t);
    if (img) {
      const src = safeImg(img[2]);
      if (src) blocks.push(<img key={`img${i}`} src={src} alt={img[1]} className="img-fluid rounded my-3 d-block" loading="lazy" />);
      i += 1;
      continue;
    }

    if (isVideoUrl(t)) {
      blocks.push(<VideoEmbed key={`v${i}`} k={`v${i}`} url={t} />);
      i += 1;
      continue;
    }

    if (isUl(t)) {
      const items = [];
      while (i < lines.length && isUl(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i += 1; }
      blocks.push(<ul key={`ul${i}`} className="mb-3">{items.map((it, j) => <li key={j}>{inline(it, `ul${i}-${j}`)}</li>)}</ul>);
      continue;
    }

    if (isOl(t)) {
      const items = [];
      while (i < lines.length && isOl(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i += 1; }
      blocks.push(<ol key={`ol${i}`} className="mb-3">{items.map((it, j) => <li key={j}>{inline(it, `ol${i}-${j}`)}</li>)}</ol>);
      continue;
    }

    // Paragraph: gather consecutive plain lines until a blank line or a new block.
    const para = [];
    while (
      i < lines.length && lines[i].trim() &&
      !isHeading(lines[i]) && !isUl(lines[i]) && !isOl(lines[i]) &&
      !IMG_RE.test(lines[i].trim()) && !isVideoUrl(lines[i].trim())
    ) {
      para.push(lines[i].trim()); i += 1;
    }
    blocks.push(<p key={`p${i}`} className="mb-3">{inline(para.join(' '), `p${i}`)}</p>);
  }

  return <div className="article-body">{blocks}</div>;
}
