import type { Brand } from "@kg/brand-config";

import { oklchToHex } from "./og-color";

export type OgCardProps = {
  brand: Brand;
  eyebrow: string;
  title: string;
  subtitle?: string;
  priceLabel?: string;
  badgeLabel?: string;
  imageUrl?: string | null;
};

export function resolvePublicOgImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "::" ||
      host === "::1" ||
      host.startsWith("0.") ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("169.254.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^f[cd][0-9a-f]{2}:/.test(host) ||
      /^fe[89ab][0-9a-f]:/.test(host)
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Satori-kompatibilis (`next/og`) 1200x630 Open Graph kártya a brand színtokenjeivel.
 * Külső font-letöltés nélkül, megbízható rendszer-sans/serif tartalékkal renderel Workers-en is.
 */
export function renderOgCard({
  brand,
  eyebrow,
  title,
  subtitle,
  priceLabel,
  badgeLabel,
  imageUrl,
}: OgCardProps) {
  const bg = oklchToHex(brand.theme.colors.background, "#1e1612");
  const card = oklchToHex(brand.theme.colors.card, "#2c211a");
  const fg = oklchToHex(brand.theme.colors.foreground, "#f5ede0");
  const mutedFg = oklchToHex(brand.theme.colors["muted-foreground"], "#c9bba6");
  const gold = oklchToHex(brand.theme.colors.gold, "#d8a84e");
  const border = oklchToHex(brand.theme.colors.border, "#7a5e3c");
  const safeImage = resolvePublicOgImageUrl(imageUrl);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: bg,
        color: fg,
        padding: "48px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          backgroundColor: card,
          border: `3px solid ${border}`,
          borderRadius: "24px",
          padding: "44px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            paddingRight: safeImage ? "36px" : "0px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                backgroundColor: gold,
                color: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 800,
              }}
            >
              {brand.name.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "24px", fontWeight: 700, color: gold }}>{brand.name}</span>
              <span style={{ fontSize: "16px", color: mutedFg }}>{eyebrow}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 800,
                lineHeight: 1.15,
                color: fg,
              }}
            >
              {title.length > 72 ? `${title.slice(0, 69)}...` : title}
            </div>
            {subtitle ? (
              <div style={{ fontSize: "22px", lineHeight: 1.4, color: mutedFg }}>
                {subtitle.length > 130 ? `${subtitle.slice(0, 127)}...` : subtitle}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {priceLabel ? (
              <div
                style={{
                  fontSize: "38px",
                  fontWeight: 800,
                  color: gold,
                }}
              >
                {priceLabel}
              </div>
            ) : null}
            {badgeLabel ? (
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: bg,
                  backgroundColor: gold,
                  padding: "8px 18px",
                  borderRadius: "999px",
                }}
              >
                {badgeLabel}
              </div>
            ) : null}
          </div>
        </div>

        {safeImage ? (
          <div
            style={{
              width: "380px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bg,
              borderRadius: "18px",
              border: `2px solid ${border}`,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={safeImage}
              alt={title}
              width={380}
              height={446}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
