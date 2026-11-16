import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StoreProvider } from "@/features/shell/StoreProvider";
import { DemoNotice, Toolbar } from "@/features/shell/Toolbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signature Path Forecasting",
  description: "Evidence-led quarterly signature forecast with a minimal CRM (demo).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <Toolbar />
          <main className="main">{children}</main>
          <footer className="footer">
            <DemoNotice />
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
