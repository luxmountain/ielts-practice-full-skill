import { Fragment } from "react";

// Scraped content uses a minimal, scraper-controlled markup convention (never inferred from plain
// prose, only ever emitted from real <strong>/<b>/<li> source nodes - see scripts/scraper/*.mjs):
// blank-line-separated paragraphs, "**bold**" runs, and "- " list-item lines. This renders that
// convention as plain React elements - no dangerouslySetInnerHTML, so scraped third-party markup
// never becomes live HTML in the browser. Content with none of these markers (all pre-existing data)
// renders exactly as the old `.split("\n\n").map(...)` code did.
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function FormattedContent({ text, paragraphClassName }: { text: string; paragraphClassName?: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => l.startsWith("- "));
        if (isList) {
          return (
            <ul key={i} className={paragraphClassName ? `${paragraphClassName} list-disc pl-5` : "mb-3 list-disc pl-5"}>
              {lines.map((line, j) => <li key={j}>{renderInline(line.slice(2))}</li>)}
            </ul>
          );
        }
        return <p key={i} className={paragraphClassName}>{renderInline(block)}</p>;
      })}
    </>
  );
}
