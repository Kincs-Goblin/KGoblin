import { Fragment } from "react";

/**
 * Biztonságos kiemelés-renderelő: kizárólag a szerver által adott `<mark>...</mark>`
 * szegmenseket alakítja `<mark>` React-elemmé (`dangerouslySetInnerHTML` nélkül).
 */
export function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(<mark>.*?<\/mark>)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("<mark>") && part.endsWith("</mark>")) {
          return (
            <mark key={index} className="rounded-xs bg-gold/25 px-0.5 font-semibold text-gold">
              {part.slice(6, -7)}
            </mark>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
