import "server-only";

import { getBrandById, type Brand } from "@kg/brand-config";
import { notFound } from "next/navigation";

/** A `[brand]` útvonal-paraméterből; ismeretlen brandre 404 (fail-closed). */
export function getBrandOrNotFound(id: string): Brand {
  const brand = getBrandById(id);
  if (!brand) notFound();
  return brand;
}
