import "../styles/globals.css";

import { fontVariableClasses } from "../theme/fonts";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={fontVariableClasses}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
