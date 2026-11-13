import { resolveRarity } from "./rarity";

const thresholds = { rare: 20000, epic: 35000, legendary: 50000 };

describe("resolveRarity", () => {
  it("a Woo-tag felülírja az ársávot", () => {
    expect(resolveRarity(["ritkasag-legendas"], 1000, thresholds)).toBe("legendary");
  });

  it("tag nélkül a normál ár sávja dönt (a határ már a magasabb szint)", () => {
    expect(resolveRarity([], 19999, thresholds)).toBe("common");
    expect(resolveRarity([], 20000, thresholds)).toBe("rare");
    expect(resolveRarity([], 35000, thresholds)).toBe("epic");
    expect(resolveRarity(["egyeb"], 54990, thresholds)).toBe("legendary");
  });
});
