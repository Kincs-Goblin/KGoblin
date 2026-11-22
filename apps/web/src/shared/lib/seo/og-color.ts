/**
 * CSS `oklch(L C H)` -> `#rrggbb` konverzió `next/og` (Satori) számára,
 * amely nem értelmezi natívan az `oklch()` színfüggvényt.
 */
function linearToSrgb(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  const value = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

export function oklchToHex(color: string, fallback: string): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;

  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+)?\s*\)$/i.exec(
    trimmed,
  );
  if (!match) return fallback;

  const rawL = Number(match[1]);
  const isPercent = match[2] === "%";
  const L = isPercent ? rawL / 100 : rawL;
  const C = Number(match[3]);
  const H = (Number(match[4]) * Math.PI) / 180;

  if (!Number.isFinite(L) || !Number.isFinite(C) || !Number.isFinite(H)) {
    return fallback;
  }

  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
