# src/entities - üzleti entitások

Típus (`model/`), lekérés (`api/`, `server-only`, export az `index.server.ts`-ből), megjelenítés (`ui/`).
Két entitás nem importálja egymást; a kapcsolatot egy feljebb lévő réteg köti össze.

Tervezett szeletek: `product`, `category`, `cart`, `order`, `customer`, `brand`.
