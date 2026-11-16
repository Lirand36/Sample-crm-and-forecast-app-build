import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/features/shell/AppShell";
import { StoreProvider } from "@/features/shell/StoreProvider";
import { PRODUCT_NAME } from "@/features/shell/labels";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "CRM with an evidence-led quarterly signature forecast.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
