import { cartReducer, countItems, MAX_QUANTITY_PER_LINE, type CartState } from "./cart-reducer";

const line = {
  productId: 1,
  slug: "eger",
  name: "Egér",
  unitPrice: { amount: "27990", currency: "HUF", minorUnit: 0 },
};
const empty: CartState = { lines: [] };

describe("cartReducer", () => {
  it("ugyanazt a terméket nem duplikálja, hanem a darabszámot növeli", () => {
    const once = cartReducer(empty, { type: "add", line });
    const twice = cartReducer(once, { type: "add", line, quantity: 2 });
    expect(twice.lines).toHaveLength(1);
    expect(twice.lines[0]?.quantity).toBe(3);
    expect(countItems(twice)).toBe(3);
  });

  it("a darabszám 0-ra állításakor a sort törli, a felső korlátot betartja", () => {
    const state = cartReducer(empty, { type: "add", line });
    expect(cartReducer(state, { type: "setQuantity", productId: 1, quantity: 0 }).lines).toEqual(
      [],
    );
    expect(
      cartReducer(state, { type: "setQuantity", productId: 1, quantity: 999 }).lines[0]?.quantity,
    ).toBe(MAX_QUANTITY_PER_LINE);
  });

  it("törlés és ürítés", () => {
    const state = cartReducer(empty, { type: "add", line });
    expect(cartReducer(state, { type: "remove", productId: 1 }).lines).toEqual([]);
    expect(cartReducer(state, { type: "clear" }).lines).toEqual([]);
  });

  it("az egységárat érintetlenül, a Woo minor unitjában őrzi", () => {
    const state = cartReducer(empty, { type: "add", line, quantity: 2 });
    expect(state.lines[0]?.unitPrice).toEqual(line.unitPrice);
  });

  it("újbóli hozzáadáskor a tárolt árat a friss Woo-árra cseréli", () => {
    const state = cartReducer(empty, { type: "add", line });
    const repriced = { ...line, unitPrice: { ...line.unitPrice, amount: "24990" } };
    const next = cartReducer(state, { type: "add", line: repriced });
    expect(next.lines[0]).toMatchObject({ quantity: 2, unitPrice: repriced.unitPrice });
  });
});
