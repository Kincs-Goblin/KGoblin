import { decodeEntities, htmlToParagraphs } from "./to-plain-text";

describe("htmlToParagraphs", () => {
  it("a tageket eltávolítja, a bekezdéseket megtartja, az entitásokat feloldja", () => {
    expect(
      htmlToParagraphs("<p>Fény (CRI &gt; 95)</p><p>Második <strong>bekezdés</strong></p>"),
    ).toEqual(["Fény (CRI > 95)", "Második bekezdés"]);
  });

  it("HTML-t (pl. eseménykezelős taget) nem ad tovább", () => {
    const result = htmlToParagraphs('<p>ok</p><img src=x onerror="alert(1)">');
    expect(result.join(" ")).not.toContain("<");
  });
});

describe("decodeEntities", () => {
  it("a számmal és névvel kódolt entitásokat feloldja (a Woo terméknevekben is küldi)", () => {
    expect(decodeEntities("17&#8243;&ndash;34&#x2033; &amp; 12&nbsp;kg")).toBe("17″–34″ & 12 kg");
  });
});
