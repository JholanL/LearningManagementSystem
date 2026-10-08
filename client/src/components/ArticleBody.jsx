// Renders KB article text safely: line breaks are preserved via CSS white-space,
// and the text is a React child (auto-escaped) — NO dangerouslySetInnerHTML, so no XSS.
export default function ArticleBody({ text = '' }) {
  return <div className="article-body">{text}</div>;
}
