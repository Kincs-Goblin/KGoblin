export const cartDrawerTexts = {
  open: (count: number) => (count > 0 ? `Kosár, ${count} termék` : "Kosár, üres"),
  title: "Zsákmányod",
  description: "A kosár tartalma ebben a böngészőben marad.",
  empty: "Még üres a zsák. Nézz körül a kincstárban!",
  unitPrice: "Egységár",
  decrease: (name: string) => `${name}: eggyel kevesebb`,
  increase: (name: string) => `${name}: eggyel több`,
  remove: (name: string) => `${name} eltávolítása`,
  quantity: "Darab",
  totalsNote: "A végösszeget, a szállítást és a kedvezményeket a pénztárban számoljuk.",
  checkout: "Pénztár hamarosan",
  continue: "Vásárlás folytatása",
} as const;
