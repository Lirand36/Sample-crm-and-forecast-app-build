// The app's simulated clock (G-11): every log entry is stamped with the session's as-of date
// and a monotonic sequence number. Nothing reads the system clock.

import type { IsoDate } from "@/domain/dates";
import type { SessionState } from "@/domain/entities";
import type { DataStore } from "./ports";

export async function readSession(store: DataStore): Promise<SessionState> {
  const session = await store.repos.session.get("session");
  if (!session) throw new Error("Session is missing: reset the demo data");
  return session;
}

/** Reserve `count` consecutive sequence numbers. Returns the first, plus the stamp date. */
export async function reserveSeq(store: DataStore, count = 1): Promise<{ seq: number; at: IsoDate }> {
  const session = await readSession(store);
  await store.repos.session.put({ ...session, nextSeq: session.nextSeq + count });
  return { seq: session.nextSeq, at: session.asOfDate };
}
