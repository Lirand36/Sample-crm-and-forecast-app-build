import { describe, expect, it } from "vitest";
import { AppendOnlyViolation } from "@/application/ports";
import { isoDate } from "@/domain/dates";
import type { ChangeLogEntry, User } from "@/domain/entities";
import { STORE_FACTORIES } from "./stores";

const user: User = { id: "u-1", name: "Test", role: "revops", team: null, managerId: null };
const entry: ChangeLogEntry = {
  id: "chg-1", entity: "opportunity", entityId: "opp-1", field: "tcv", oldValue: "1", newValue: "2",
  actorId: "u-1", at: isoDate("2027-03-01"), seq: 1, reason: null,
};

describe.each(STORE_FACTORIES)("repository contract: %s", (_name, make) => {
  it("puts, gets and replaces mutable records", async () => {
    const store = await make();
    await store.repos.users.put(user);
    expect(await store.repos.users.get("u-1")).toEqual(user);
    await store.repos.users.put({ ...user, name: "Renamed" });
    expect((await store.repos.users.get("u-1"))?.name).toBe("Renamed");
    expect(await store.repos.users.get("missing")).toBeUndefined();
  });

  it("appends and refuses to overwrite append-only records (DR-16)", async () => {
    const store = await make();
    await store.repos.changeLog.append(entry);
    await expect(store.repos.changeLog.append({ ...entry, newValue: "tampered" })).rejects.toBeInstanceOf(AppendOnlyViolation);
    expect((await store.repos.changeLog.get("chg-1"))?.newValue).toBe("2");
  });

  it("exposes no update or delete path on append-only collections", async () => {
    const store = await make();
    const repo = store.repos.forecastRuns as unknown as Record<string, unknown>;
    expect(repo.put).toBeUndefined();
    expect(repo.update).toBeUndefined();
    expect(repo.delete).toBeUndefined();
    expect(typeof repo.append).toBe("function");
  });

  it("returns copies, so callers cannot mutate stored records", async () => {
    const store = await make();
    await store.repos.users.put(user);
    const got = (await store.repos.users.get("u-1"))!;
    got.name = "Mutated";
    expect((await store.repos.users.get("u-1"))?.name).toBe("Test");
  });

  it("lists records sorted by id", async () => {
    const store = await make();
    await store.repos.users.put({ ...user, id: "u-b" });
    await store.repos.users.put({ ...user, id: "u-a" });
    expect((await store.repos.users.list()).map((u) => u.id)).toEqual(["u-a", "u-b"]);
  });
});
