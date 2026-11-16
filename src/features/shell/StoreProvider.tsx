"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadForecast } from "@/application/forecast";
import type { Forecast } from "@/domain/forecast";
import { impactOf, isEmptyImpact, type Impact } from "@/domain/impact";
import type { DataStore } from "@/application/ports";
import { ensureSeeded, resetToSeed } from "@/application/reset";
import type { SessionState, User } from "@/domain/entities";
import { openIndexedDbStore } from "@/infrastructure/storage/indexeddb";
import { buildCanonicalSeed } from "@/seed/canonical";

interface StoreContextValue {
  store: DataStore;
  session: SessionState;
  users: User[];
  actingUser: User;
  /** Increments after every write so views re-read. */
  revision: number;
  /** Re-read after a write. The label names the action in the "what it did" panel. */
  refresh: (label?: string) => Promise<void>;
  /** What the last write did to the forecast, until dismissed. */
  impact: { label: string; impact: Impact; seq: number } | null;
  dismissImpact: () => void;
  reset: () => Promise<void>;
  setActingUser: (userId: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; store: DataStore; session: SessionState; users: User[]; revision: number };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [impact, setImpact] = useState<StoreContextValue["impact"]>(null);
  const snapshot = useRef<Forecast | null>(null);

  /** Recompute the forecast and keep the difference from the previous one, if there is any. */
  const track = useCallback(async (store: DataStore, label: string | null) => {
    try {
      const next = await loadForecast(store);
      const prev = snapshot.current;
      snapshot.current = next;
      if (!prev || label === null) return;
      const i = impactOf(prev, next);
      if (!isEmptyImpact(i)) setImpact((old) => ({ label, impact: i, seq: (old?.seq ?? 0) + 1 }));
    } catch {
      // The forecast cannot be computed (e.g. mid-edit data): no panel, the pages show their own errors.
    }
  }, []);

  const readAll = useCallback(async (store: DataStore, revision: number) => {
    const session = await store.repos.session.get("session");
    if (!session) throw new Error("Session record missing after seeding");
    const users = await store.repos.users.list();
    setState({ status: "ready", store, session, users, revision });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof indexedDB === "undefined") throw new Error("This browser does not provide IndexedDB storage.");
        const store = await openIndexedDbStore();
        await ensureSeeded(store, buildCanonicalSeed());
        if (!cancelled) {
          await track(store, null);
          await readAll(store, 0);
        }
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readAll, track]);

  const value = useMemo<StoreContextValue | null>(() => {
    if (state.status !== "ready") return null;
    const { store, session, users, revision } = state;
    const actingUser = users.find((u) => u.id === session.actingUserId) ?? users[0]!;
    return {
      store,
      session,
      users,
      actingUser,
      revision,
      refresh: async (label?: string) => {
        await track(store, label ?? "Your change");
        await readAll(store, revision + 1);
      },
      impact,
      dismissImpact: () => setImpact(null),
      reset: async () => {
        await resetToSeed(store, buildCanonicalSeed());
        setImpact(null);
        await track(store, null);
        await readAll(store, revision + 1);
      },
      setActingUser: async (userId: string) => {
        await store.repos.session.put({ ...session, actingUserId: userId });
        await readAll(store, revision + 1);
      },
    };
  }, [state, readAll, track, impact]);

  if (state.status === "loading") {
    return <div className="boot">Loading…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="boot boot-error" role="alert">
        <strong>The app could not open its browser storage.</strong>
        <p>{state.message}</p>
      </div>
    );
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
