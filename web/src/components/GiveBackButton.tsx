"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { giveBack } from "@/actions/team";

export function GiveBackButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Give this voucher back? It goes to the next team and you must not use it anymore.",
          )
        )
          return;
        startTransition(async () => {
          const result = await giveBack(assignmentId);
          if (!result.success) alert(result.error);
          router.refresh();
        });
      }}
      className="btn-sm hover:border-bad hover:text-bad"
    >
      {pending ? "giving back…" : "can't use it, give back"}
    </button>
  );
}
