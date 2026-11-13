import { notFound } from "next/navigation";

/** Ismeretlen útvonal a brandon belül: a brand-layouton belüli 404-et mutatja. */
export default function CatchAllPage() {
  notFound();
}
