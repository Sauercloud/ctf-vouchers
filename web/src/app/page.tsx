import Link from "next/link";
import { config } from "@/lib/config";
import { getState } from "@/lib/distribute";
import { prisma } from "@/lib/prisma";
import { berlinTime, seedHash } from "@/lib/views";

export const dynamic = "force-dynamic";

const steps = [
  "Sign in with your team's CTFtime account. Any team that has played or organized a CTF can register.",
  "Tell us how many people need a voucher and where to mail them.",
  `When the first vouchers arrive (expected ${berlinTime(config.voucherPhaseStart)}), the list is frozen and shuffled with a seed we publish. Teams that register later, or ask for more after that, go to the back of every round for the additional vouchers.`,
  `Each round, every team gets up to ${config.perRound} vouchers until it has what it asked for. Vouchers go out the moment we get them.`,
  `Redeem within 24 hours and enter the address from our mail as the recipient of the new voucher. Pay right away, then confirm as soon as possible by writing to the confirmation address from the mail.`,
];

const rules = [
  "Use the replication address from the mail. Nothing else.",
  "Pay with the fastest method available. No payment, no new voucher for the next team.",
  "Can't use a voucher? Press “give back” on your dashboard instead of sitting on it.",
  "Teams that keep vouchers without passing them on are out, this year and next.",
];

async function stats() {
  const [state, teams, asked, handedOut, cameBack] = await Promise.all([
    getState(prisma),
    prisma.team.count({ where: { registeredAt: { not: null }, banned: false } }),
    prisma.team.aggregate({ _sum: { requested: true }, where: { registeredAt: { not: null }, banned: false } }),
    prisma.assignment.count({ where: { slotRefunded: false } }),
    prisma.assignment.count({ where: { replicatedAt: { not: null } } }),
  ]);
  return { state, teams, asked: asked._sum.requested ?? 0, handedOut, cameBack };
}

export default async function Home() {
  const s = await stats();

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_16rem]">
      <div className="max-w-2xl space-y-10">
        <section className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            40C3 vouchers for the CTF community
          </h1>
          <p className="text-muted">
            The CCC hands out presale vouchers to communities, and every paid ticket bought with one
            produces a new voucher, roughly once per bank day. We pool the vouchers we get and pass
            them along CTF teams in a fixed order until the quota runs out or the voucher phase ends.
            Asking for vouchers doesn&apos;t guarantee you get any.
          </p>
          <p className="text-muted">
            The voucher phase runs from {berlinTime(config.voucherPhaseStart)} until{" "}
            {berlinTime(config.voucherPhaseEnd)}. The CCC explains how it works in the{" "}
            <a href={config.presaleInfoUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              presale modus operandi
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="label mb-4">how it works</h2>
          <ol className="divide-y divide-rule border-y border-rule">
            {steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[2.5rem_1fr] py-3">
                <span className="font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="label mb-4">rules</h2>
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule} className="grid grid-cols-[2.5rem_1fr]">
                <span className="font-mono text-muted">—</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        <Link href="/dashboard" className="btn">
          register your team →
        </Link>
      </div>

      <aside className="order-first h-fit border border-rule font-mono text-sm lg:order-none lg:sticky lg:top-10">
        <div className="border-b border-rule px-4 py-3">
          <div className="label">status</div>
          <div className="mt-1">
            {s.state.frozenAt ? (
              <span>
                <span className="text-accent">●</span> distributing
              </span>
            ) : (
              <span>
                <span className="text-ok">●</span> registration open
              </span>
            )}
          </div>
        </div>
        <div className="border-b border-rule px-4 py-3">
          <div className="label">voucher phase</div>
          <div className="mt-1">{berlinTime(config.voucherPhaseStart)}</div>
          <div>– {berlinTime(config.voucherPhaseEnd)}</div>
          <a href={config.presaleInfoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-accent">
            modus operandi ↗
          </a>
        </div>
        <dl className="divide-y divide-rule">
          {[
            ["teams", s.teams],
            ["vouchers asked for", s.asked],
            ["handed out", s.handedOut],
            ["came back", s.cameBack],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {seedHash(s.state) && (
          <div className="border-t border-rule px-4 py-3">
            <div className="label">seed sha-256</div>
            <Link href="/sequence" className="mt-1 block break-all text-xs text-muted hover:text-fg">
              {seedHash(s.state)}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
