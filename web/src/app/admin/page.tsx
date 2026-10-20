import { requireAdminPage } from "@/lib/admin";
import { config } from "@/lib/config";
import { getState } from "@/lib/distribute";
import { prisma } from "@/lib/prisma";
import { ActionForm, ErrorBanner, fmt, inputClass } from "./ui";

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;
  const state = await getState(prisma);

  const [teams, vouchers, held, free, pending, failed, flagged] = await Promise.all([
    prisma.team.count({ where: { registeredAt: { not: null } } }),
    prisma.voucher.groupBy({ by: ["source"], _count: true }),
    prisma.voucher.findMany({ where: { held: true }, include: { parentAssignment: { include: { team: true } } } }),
    prisma.voucher.count({ where: { held: false, assignments: { none: { revokedAt: null } } } }),
    prisma.outboundMail.count({ where: { status: { in: ["PENDING", "SENDING"] } } }),
    prisma.outboundMail.count({ where: { status: "FAILED" } }),
    prisma.assignment.count({
      where: {
        revokedAt: null,
        OR: [
          { unconfirmedFlaggedAt: { not: null }, confirmedAt: null },
          { overdueFlaggedAt: { not: null }, replicatedAt: null },
        ],
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <ErrorBanner error={error} />

      <section className="space-y-2">
        <h1 className="text-xl font-semibold">State</h1>
        <p>
          Frozen: {state.frozenAt ? `${fmt(state.frozenAt)} (${state.frozenTeamIds.length} teams, seed ${state.seed})` : "no"}
        </p>
        <p>Registered teams: {teams}</p>
        <p>
          Vouchers: {vouchers.map((v) => `${v._count} ${v.source.toLowerCase()}`).join(", ") || "none"} ·{" "}
          {free} unassigned · {held.length} held
        </p>
        <p>
          Outbox: {pending} pending · {failed} failed · Flagged assignments: {flagged}
        </p>
        <p className="text-sm text-muted">
          Seed address: seed-{config.seedSecret || "<SEED_SECRET unset>"}@{config.mailDomain}
          {config.mailDryRun && " · MAIL DRY RUN"}
        </p>
        <div className="flex gap-2">
          {!state.frozenAt && (
            <ActionForm action="freeze" back="/admin" label="freeze & shuffle now" danger />
          )}
          <ActionForm action="tick" back="/admin" label="run tick now" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="label">Add vouchers manually</h2>
        <ActionForm action="vouchers-add" back="/admin" label="add">
          <textarea name="codes" rows={3} cols={50} className={inputClass} placeholder="one code per line" />
        </ActionForm>
      </section>

      <section className="space-y-2">
        <h2 className="label">Held vouchers</h2>
        {held.length === 0 && <p className="text-muted">None.</p>}
        <ul className="space-y-2">
          {held.map((v) => (
            <li key={v.id} className="flex flex-wrap gap-3 items-center text-sm">
              <span className="font-mono">{v.code}</span>
              <span className="text-muted">
                {v.source.toLowerCase()}
                {v.parentAssignment && ` from ${v.parentAssignment.team.name}`} · {v.heldReason}
              </span>
              <ActionForm action="voucher-release" back="/admin" fields={{ id: v.id }} label="release" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
