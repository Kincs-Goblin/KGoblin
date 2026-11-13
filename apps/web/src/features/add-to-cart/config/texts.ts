export const addToCartTexts = {
  add: "Kosárba",
  added: "Kosárban",
  unavailable: "Nem elérhető",
  labelFor: (name: string) => `${name} kosárba tétele`,
  toast: (name: string) => `Kosárba tettük: ${name}`,
} as const;
