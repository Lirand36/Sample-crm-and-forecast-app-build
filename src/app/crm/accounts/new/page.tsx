"use client";

import { useRouter } from "next/navigation";
import { createAccount } from "@/application/crm";
import { AccountForm } from "@/features/crm/AccountForm";
import { useStore } from "@/features/shell/StoreProvider";

export default function NewAccountPage() {
  const router = useRouter();
  const { store, refresh } = useStore();
  return (
    <section>
      <h1>New account</h1>
      <AccountForm
        submitLabel="Create account"
        onCancel={() => router.push("/crm/accounts")}
        onSubmit={async (input) => {
          const result = await createAccount(store, input);
          if (result.ok) {
            await refresh();
            router.push(`/crm/accounts/${result.value.id}`);
          }
          return result;
        }}
      />
    </section>
  );
}
