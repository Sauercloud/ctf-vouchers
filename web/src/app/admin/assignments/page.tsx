import { requireAdminPage } from "@/lib/admin";
import { replicaAddress } from "@/lib/addresses";
import { prisma } from "@/lib/prisma";
import { ActionForm, ErrorBanner, fmt, inputClass } from "../ui";

export default async function AdminAssignments({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; all?: string }>;
}) {
  await requireAdminPage();
  const { error, all } = await searchParams;
  const assignments = await prisma.assignment.findMany({
    where: all ? {} : { revokedAt: null, replicatedAt: null },
    include: { team: true, voucher: true, replicas: true },
    orderBy: { createdAt: "desc" },
  });
  const back = all ? "/admin/assignments?all=1" : "/admin/assignments";

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} />
      <div className="flex gap-4 items-baseline">
        <h1 className="text-xl font-semibold">
          {all ? "All assignments" : "Open assignments (not replicated)"}
        </h1>
        <a href={all ? "/admin/assignments" : "/admin/assignments?all=1"} className="text-accent text-sm">
          {all ? "show open only" : "show all"}
        </a>
      </div>
      <ul className="space-y-3">
        {assignments.map((a) => {
          const unconfirmed = a.unconfirmedFlaggedAt && !a.confirmedAt;
          const overdue = a.overdueFlaggedAt && !a.replicatedAt;
          return (
            <li
              key={a.id}
              className={`border border-rule p-3 text-sm space-y-1 ${
                !a.revokedAt && (unconfirmed || overdue) ? "border border-bad" : ""
              }`}
            >
              <div className="flex flex-wrap gap-x-4">
                <span className="font-semibold">{a.team.name}</span>
                <span>round {a.round + 1}</span>
                <span className="font-mono">{a.voucher.code}</span>
                <span className="text-muted font-mono">{replicaAddress(a.token)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 text-muted">
                <span>assigned {fmt(a.createdAt)}</span>
                <span>sent {fmt(a.sentAt)}</span>
                <span>confirmed {fmt(a.confirmedAt)}</span>
                <span>replicated {fmt(a.replicatedAt)}</span>
                {a.confirmNote && <span className="text-warn">{a.confirmNote}</span>}
                {unconfirmed && <span className="text-bad">unconfirmed since {fmt(a.unconfirmedFlaggedAt)}</span>}
                {overdue && <span className="text-bad">overdue since {fmt(a.overdueFlaggedAt)}</span>}
                {a.revokedAt && (
                  <span className="text-bad">
                    revoked {fmt(a.revokedAt)} ({a.revokeReason}
                    {a.slotRefunded ? ", slot refunded" : ""})
                  </span>
                )}
                {a.replicas.length > 0 && <span>replicas: {a.replicas.map((r) => r.code).join(", ")}</span>}
              </div>
              {!a.revokedAt && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {!a.confirmedAt && (
                    <ActionForm action="assignment-confirm" back={back} fields={{ id: a.id }} label="mark confirmed" />
                  )}
                  <ActionForm action="assignment-resend" back={back} fields={{ id: a.id }} label="resend mail" />
                  {(unconfirmed || overdue) && (
                    <ActionForm action="assignment-clear-flags" back={back} fields={{ id: a.id }} label="clear flags" />
                  )}
                  {!a.replicatedAt && (
                    <ActionForm action="assignment-revoke" back={back} fields={{ id: a.id }} label="revoke" danger>
                      <input name="reason" placeholder="reason" className={inputClass} />
                      <label className="text-xs">
                        <input type="checkbox" name="refund" /> refund slot
                      </label>
                      <label className="text-xs">
                        <input type="checkbox" name="hold" /> hold voucher (else reassign)
                      </label>
                    </ActionForm>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
