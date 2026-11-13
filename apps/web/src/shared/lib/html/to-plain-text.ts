const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  rdquo: "”",
  ldquo: "“",
  lsquo: "‘",
  rsquo: "’",
  times: "×",
};

/** HTML-entitások feloldása (névvel és számmal kódolt); ismeretlennél szóköz. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    }
    return namedEntities[entity.toLowerCase()] ?? " ";
  });
}

/**
 * A Woo HTML-leírásából bekezdésenkénti sima szöveg. HTML-t nem renderelünk sanitizer nélkül.
 */
export function htmlToParagraphs(html: string): string[] {
  return decodeEntities(
    html.replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
