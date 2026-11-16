"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  refresh: () => Promise<void>;
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
        if (!cancelled) await readAll(store, 0);
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readAll]);

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
      refresh: () => readAll(store, revision + 1),
      reset: async () => {
        await resetToSeed(store, buildCanonicalSeed());
        await readAll(store, revision + 1);
      },
      setActingUser: async (userId: string) => {
        await store.repos.session.put({ ...session, actingUserId: userId });
        await readAll(store, revision + 1);
      },
    };
  }, [state, readAll]);

  if (state.status === "loading") {
    return <div className="boot">Loading the demo data in this browser…</div>;
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
