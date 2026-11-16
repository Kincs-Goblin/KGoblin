export const productPageTexts = {
  breadcrumbHome: "Főoldal",
  breadcrumbLabel: "Morzsamenü",
  sku: "Cikkszám",
  descriptionHeading: "Leírás",
  specsHeading: "Tulajdonságok",
  variantGroupLabel: "Változatok",
  unavailableCombination: "Ez a kombináció nem elérhető",
  errorTitle: "Ezt a kincset most nem tudjuk előhozni",
  gallery: {
    thumbnailsLabel: "Termékképek",
    selectImage: (index: number) => `${index}. kép megjelenítése`,
    prevImage: "Előző kép",
    nextImage: "Következő kép",
    openZoom: "Nagyítás megnyitása",
    zoomTitle: (name: string) => `${name} - nagyított nézet`,
    imageCounter: (current: number, total: number) => `${current} / ${total}`,
  },
} as const;
