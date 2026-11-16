"use client";

import { useRouter } from "next/navigation";
import { createOpportunity } from "@/application/crm";
import { CrmTabs, useStoreQuery } from "@/features/crm/ui";
import { OpportunityForm } from "@/features/crm/OpportunityForm";
import { useStore } from "@/features/shell/StoreProvider";

export default function NewOpportunityPage() {
  const router = useRouter();
  const { store, actingUser, refresh } = useStore();
  const data = useStoreQuery(async (s) => ({ accounts: await s.repos.accounts.list(), users: await s.repos.users.list() }));
  if (!data) return <p>Loading…</p>;

  return (
    <section>
      <CrmTabs />
      <h1>New opportunity</h1>
      <p className="muted">
        One opportunity is one contract. Its Conditions come from the deal type&apos;s template, fixed at creation.
      </p>
      <OpportunityForm
        mode="create"
        accounts={data.accounts}
        users={data.users}
        actor={actingUser}
        submitLabel="Create opportunity"
        onCancel={() => router.push("/crm/opportunities")}
        onSubmit={async (input) => {
          const result = await createOpportunity(store, input);
          if (result.ok) {
            await refresh();
            router.push(`/crm/opportunities/${result.value.id}`);
          }
          return result;
        }}
      />
    </section>
  );
}
