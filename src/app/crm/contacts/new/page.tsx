"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createContact } from "@/application/crm";
import { ContactForm } from "@/features/crm/ContactForm";
import { useStoreQuery } from "@/features/crm/ui";
import { useStore } from "@/features/shell/StoreProvider";

function NewContact() {
  const router = useRouter();
  const params = useSearchParams();
  const fromAccount = params.get("account") ?? undefined;
  const { store, refresh } = useStore();
  const accounts = useStoreQuery((s) => s.repos.accounts.list());
  if (!accounts) return <p>Loading…</p>;
  const back = fromAccount ? `/crm/accounts/${fromAccount}` : "/crm/contacts";
  return (
    <section>
      <h1>New contact</h1>
      <ContactForm
        accounts={accounts}
        defaultAccountId={fromAccount}
        submitLabel="Create contact"
        onCancel={() => router.push(back)}
        onSubmit={async (input) => {
          const result = await createContact(store, input);
          if (result.ok) {
            await refresh();
            router.push(fromAccount ? back : `/crm/contacts/${result.value.id}`);
          }
          return result;
        }}
      />
    </section>
  );
}

export default function NewContactPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewContact />
    </Suspense>
  );
}
