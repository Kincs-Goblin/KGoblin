export { HomePage as default } from "@/pages/home";

// A főoldal buildkor előrenderelődik; ha akkor a Woo nem elérhető, a hibaállapot se maradjon végleg
// statikus. Az érték a termék-fetchek revalidate-jével egyezik.
export const revalidate = 300;
