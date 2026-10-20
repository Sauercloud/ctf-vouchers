import { redirect } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { GiveBackButton } from "@/components/GiveBackButton";
import { TeamForm } from "@/components/TeamForm";
import { confirmAddress, replicaAddress } from "@/lib/addresses";
import { currentTeamId } from "@/lib/auth";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { loadSequence } from "@/lib/views";

export const dynamic = "force-dynamic";

function status(a: {
  revokedAt: Date | null;
  replicatedAt: Date | null;
  confirmedAt: Date | null;
  sentAt: Date | null;
}) {
  if (a.revokedAt) return { color: "text-muted", text: "given back" };
  if (a.replicatedAt) return { color: "text-ok", text: "came back as a new voucher, thanks" };
  if (a.confirmedAt) return { color: "text-warn", text: "confirmed, waiting for the new voucher" };
  if (a.sentAt) return { color: "text-accent", text: "sent: redeem it, pay, reply to the mail" };
  return { color: "text-muted", text: "queued for sending" };
}

export default async function DashboardPage() {
  const teamId = await currentTeamId();
  if (!teamId) redirect("/api/auth/signin");

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      assignments: { include: { voucher: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!team) redirect("/api/auth/signin");

  const seq = await loadSequence();
  const positions = seq.rounds.flatMap((entries, r) =>
    entries.flatMap((e, index) =>
      e.teamId === team.id ? [{ round: r, index, total: entries.length, entry: e }] : [],
    ),
  );

  return (
    <div className="grid gap-12 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-10">
        <header>
          <div className="label">team</div>
          <h1 className="text-3xl font-semibold">{team.name}</h1>
          <a href={`https://ctftime.org/team/${team.id}`} className="font-mono text-xs text-muted">
            ctftime #{team.id}
          </a>
        </header>

        {team.banned ? (
          <p className="border-l-2 border-bad pl-4 text-bad">
            Your team is excluded from the distribution{team.banReason ? `: ${team.banReason}` : "."}
          </p>
        ) : (
          <section>
            <h2 className="label mb-4">{team.registeredAt ? "registration" : "register"}</h2>
            <TeamForm
              requested={team.requested}
              contactEmail={team.contactEmail ?? ""}
              registered={team.registeredAt !== null}
              frozen={seq.frozenAt !== null}
              maxRequest={config.maxRequest}
            />
          </section>
        )}

        {seq.frozenAt && positions.length > 0 && (
          <section>
            <h2 className="label mb-3">your place in line</h2>
            <table className="w-full font-mono text-sm">
              <tbody>
                {positions.map((p) => (
                  <tr key={`${p.round}-${p.index}`} className="border-b border-rule">
                    <td className="py-1.5 text-muted">
                      round {p.round + 1}
                      {p.entry.tag && <span className="ml-2 text-xs text-warn">{p.entry.tag}</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      {p.index + 1}
                      <span className="text-muted"> / {p.total}</span>
                    </td>
                    <td className="py-1.5 text-right">
                      {p.entry.got}/{p.entry.want}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <section>
        <h2 className="label mb-4">vouchers</h2>
        {team.assignments.length === 0 ? (
          <p className="text-muted">
            {seq.frozenAt
              ? "None yet. We mail them to your contact address as soon as it's your turn."
              : "Nothing yet. Distribution starts once the first vouchers arrive from the CCC."}
          </p>
        ) : (
          <ul className="space-y-4">
            {team.assignments.map((a) => {
              const s = status(a);
              return (
                <li key={a.id} className={`border border-rule ${a.revokedAt ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
                    <span className="break-all font-mono text-sm sm:text-lg">{a.voucher.code}</span>
                    {!a.revokedAt && <CopyButton value={a.voucher.code} />}
                  </div>
                  <div className="space-y-3 px-4 py-3 text-sm">
                    <div className={`font-mono text-xs ${s.color}`}>● {s.text}</div>
                    {!a.revokedAt && (
                      <>
                        <div>
                          <div className="label">send the new voucher to</div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="break-all font-mono text-xs sm:text-sm">{replicaAddress(a.token)}</span>
                            <CopyButton value={replicaAddress(a.token)} />
                          </div>
                        </div>
                        {!a.confirmedAt && (
                          <div>
                            <div className="label">redeemed it? reply to our mail or write to</div>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="break-all font-mono text-xs sm:text-sm">{confirmAddress(a.token)}</span>
                              <CopyButton value={confirmAddress(a.token)} />
                            </div>
                          </div>
                        )}
                        {!a.confirmedAt && !a.replicatedAt && <GiveBackButton assignmentId={a.id} />}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
