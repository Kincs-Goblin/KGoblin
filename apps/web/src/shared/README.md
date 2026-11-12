# src/shared - brand- és üzletfüggetlen alap

Nem szeletelt, csak szegmensek:

| Szegmens | Tartalom |
|---|---|
| `ui/` | shadcn/ui komponensek, design tokenekre igazítva |
| `lib/` | pénz- és dátumformázás, hibakód-katalógus (`errors`), analytics-segédek |
| `api/` | Woo-kliens brand-kontextussal (`packages/woo-client` köré), cache-tag képzés |
| `config/` | env-séma (Zod, server és client külön), útvonal-konstansok |

Üzleti szabály (ár, kosár, rendelés) nem kerül ide.
