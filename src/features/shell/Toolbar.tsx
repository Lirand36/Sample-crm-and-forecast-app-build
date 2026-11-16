"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { formatDisplayDate } from "@/domain/dates";
import { useStore } from "./StoreProvider";
import { userLabel } from "./labels";

const AREAS = [
  { href: "/forecast", label: "Forecast" },
  { href: "/crm", label: "CRM" },
];

export function Toolbar() {
  const { users, actingUser, session, reset, setActingUser } = useStore();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function onReset() {
    setBusy(true);
    try {
      await reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <span className="brand">Signature Path</span>
        <nav aria-label="Areas">
          {AREAS.map((a) => (
            <Link key={a.href} href={a.href} className={pathname?.startsWith(a.href) ? "nav-link active" : "nav-link"}>
              {a.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="toolbar-right">
        <span className="asof" title="The date the engine computes for. It is an input, never the system clock.">
          As of <strong>{formatDisplayDate(session.asOfDate)}</strong>
        </span>
        <label className="role">
          <span className="sr-only">Acting as</span>
          <select
            value={actingUser.id}
            onChange={(e) => void setActingUser(e.target.value)}
            aria-label="Acting as (role switcher)"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {userLabel(u)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={onReset} disabled={busy} data-testid="reset">
          {busy ? "Resetting…" : "Reset"}
        </button>
      </div>
    </header>
  );
}

export function DemoNotice() {
  return (
    <p className="demo-notice">
      Single-presenter demo. This browser holds its own copy of the data; nothing is shared between browsers. All
      records are fictional seeded demo data or manual imports.
    </p>
  );
}
