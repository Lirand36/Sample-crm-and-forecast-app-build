"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { formatDisplayDate } from "@/domain/dates";
import { useStore } from "./StoreProvider";
import { PRODUCT_NAME, userLabel } from "./labels";

interface NavItem {
  href: string;
  label: string;
}

const CRM_NAV: NavItem[] = [
  { href: "/crm/opportunities", label: "Opportunities" },
  { href: "/crm/accounts", label: "Accounts" },
  { href: "/crm/contacts", label: "Contacts" },
];
const APPS_NAV: NavItem[] = [
  { href: "/forecast", label: "Forecast" },
  { href: "/evidence", label: "Evidence review" },
];
const ADMIN_NAV: NavItem[] = [{ href: "/admin", label: "Administration" }];

function NavSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string | null }) {
  return (
    <div className="nav-section">
      <div className="nav-title">{title}</div>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={pathname?.startsWith(item.href) ? "nav-item active" : "nav-item"}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { users, actingUser, session, setActingUser } = useStore();
  const pathname = usePathname();
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/crm/opportunities" className="brand">
          {PRODUCT_NAME}
        </Link>
        <div className="topbar-right">
          <span className="today" title="The app runs on a fixed calendar so every walkthrough shows the same numbers. Q1 2027 ends on March 31.">
            Today: {formatDisplayDate(session.asOfDate)}
          </span>
          <label className="role">
            <span className="muted small">Signed in as</span>
            <select value={actingUser.id} onChange={(e) => void setActingUser(e.target.value)} aria-label="Signed in as">
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
      </div>
    </div>
  );
}
