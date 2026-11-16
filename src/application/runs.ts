// Stored Forecast runs: one automatic run per as-of date, one per Submission (PRD §4K, DR-16, C-1),
// and the "Next week" demo control (Part VII).

import { addDays } from "@/domain/dates";
import type { ForecastRun, Submission } from "@/domain/entities";
import { snapshotRun } from "@/domain/run-snapshot";
import { EXTRACTION_VERSION, NEXT_WEEK_READING } from "@/seed/canonical";
import { readSession, reserveSeq } from "./clock";
import type { CrmResult } from "./crm";
import { loadForecastWithData } from "./forecast";
import type { DataStore } from "./ports";

async function storeRun(store: DataStore, trigger: ForecastRun["trigger"]): Promise<ForecastRun> {
  const { forecast, data } = await loadForecastWithData(store);
  const { seq } = await reserveSeq(store);
  const id = `run-${forecast.asOf}-${trigger}-${seq}`;
  const { run, lines } = snapshotRun(forecast, data, {
    id,
    trigger,
    seq,
    templateVersions: [...new Set(data.conditionTemplates.map((t) => t.id))],
    extractionVersion: EXTRACTION_VERSION,
  });
  await store.repos.forecastRuns.append(run);
  for (const line of lines) await store.repos.runLines.append(line);
  return run;
}

/** The end-of-day run for the current as-of date, stored once (DR-16). */
export async function ensureDailyRun(store: DataStore): Promise<ForecastRun> {
  const session = await readSession(store);
  const existing = (await store.repos.forecastRuns.list()).find((r) => r.asOfDate === session.asOfDate && r.trigger === "automatic");
  return existing ?? storeRun(store, "automatic");
}

/** A Sales Manager's formal position: freezes a run and points to it (PRD §4K.4). */
export async function submitForecast(store: DataStore): Promise<CrmResult<Submission>> {
  const session = await readSession(store);
  const actor = await store.repos.users.get(session.actingUserId);
  if (!actor || actor.role !== "sales_manager") return { ok: false, errors: { form: "Only a Sales Manager submits a forecast." } };
  const run = await storeRun(store, "submission");
  const { seq, at } = await reserveSeq(store);
  const submission: Submission = { id: `sub-${seq}`, runId: run.id, managerId: actor.id, submittedAt: at, seq };
  await store.repos.submissions.append(submission);
  return { ok: true, value: submission };
}

/**
 * "Next week": close the current day with its automatic run, move the as-of date forward seven days,
 * and load the next weekly Pilot reading if it is due (Part VII demo controls).
 */
export async function advanceOneWeek(store: DataStore): Promise<void> {
  await ensureDailyRun(store);
  const session = await readSession(store);
  const next = addDays(session.asOfDate, 7);
  await store.repos.session.put({ ...session, asOfDate: next });
  const due = NEXT_WEEK_READING.weekEnding <= next;
  if (due && !(await store.repos.pilotReadings.get(NEXT_WEEK_READING.id))) {
    await store.repos.pilotReadings.append({ ...NEXT_WEEK_READING, sourceLabel: "seeded" });
  }
}
