"use client";

import { ImpactPanel } from "./ImpactPanel";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { formatDisplayDate } from "@/domain/dates";
import { useStore } from "./StoreProvider";
import { PRODUCT_NAME, userLabel } from "./labels";

interface NavItem {
  href: string;
  label: string;
  sub?: boolean;
}

const CRM_NAV: NavItem[] = [
  { href: "/crm/accounts", label: "Accounts" },
  { href: "/crm/contacts", label: "Contacts" },
  { href: "/crm/opportunities", label: "Opportunities" },
];
const APPS_NAV: NavItem[] = [
  { href: "/forecast", label: "Forecast" },
  { href: "/forecast/backtest", label: "Previous quarters", sub: true },
  { href: "/slack", label: "Slack" },
];
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Administration" },
  { href: "/how-it-works", label: "How it works" },
];

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string | null;
}) {
  return (
    <div className="nav-section">
      <div className="nav-title">{title}</div>
      {items.map((item) => {
        const active =
          item.sub || !items.some((x) => x.sub && pathname?.startsWith(x.href))
            ? pathname?.startsWith(item.href)
            : false;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${item.sub ? " nav-sub" : ""}${active ? " active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { users, actingUser, session, setActingUser } = useStore();
  const pathname = usePathname();
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/crm/accounts" className="brand">
          {PRODUCT_NAME}
        </Link>
        <div className="topbar-right">
          <span
            className="today"
            title="The app runs on a fixed calendar so every walkthrough shows the same numbers. Q1 2027 ends on March 31."
          >
            Today: {formatDisplayDate(session.asOfDate)}
          </span>
          <label className="role">
            <span className="muted small">Signed in as</span>
            <select
              value={actingUser.id}
              onChange={(e) => void setActingUser(e.target.value)}
              aria-label="Signed in as"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div className="body">
        <aside className="sidebar" aria-label="Main menu">
          <NavSection title="CRM" items={CRM_NAV} pathname={pathname} />
          <NavSection title="Apps" items={APPS_NAV} pathname={pathname} />
          <NavSection title="Settings" items={ADMIN_NAV} pathname={pathname} />
        </aside>
        <main className="main">{children}</main>
        <ImpactPanel />
      </div>
    </div>
  );
}
