import { config } from "@/lib/config";
import { berlinTime, loadSequence } from "@/lib/views";

export const dynamic = "force-dynamic";

function Blocks({ got, want }: { got: number; want: number }) {
  return (
    <span className="font-mono tracking-widest" title={`${got} of ${want}`}>
      <span className="text-accent">{"■".repeat(got)}</span>
      <span className="text-rule">{"■".repeat(want - got)}</span>
    </span>
  );
}

export default async function SequencePage() {
  const seq = await loadSequence();

  if (!seq.frozenAt) {
    return (
      <div className="space-y-8">
        <header className="max-w-2xl space-y-3">
          <h1 className="text-3xl font-semibold">Sequence</h1>
          <p className="text-muted">
            Registration is open. The order gets frozen and shuffled once the first vouchers
            arrive, expected {berlinTime(config.voucherPhaseStart)}. Until then, here is everyone who
            signed up.
          </p>
          {seq.seedHash && (
            <p className="text-sm text-muted">
              The shuffle seed is fixed already and gets published here at the freeze. Its SHA-256:{" "}
              <span className="break-all font-mono text-fg">{seq.seedHash}</span>
            </p>
          )}
        </header>
        <section>
          <h2 className="label mb-3">{seq.teams.length} teams registered</h2>
          <ul className="grid grid-cols-1 gap-x-8 border-t border-rule sm:grid-cols-2 lg:grid-cols-3">
            {seq.teams.map((t) => (
              <li key={t.id} className="flex justify-between border-b border-rule py-1.5">
                <span className="truncate">{t.name}</span>
                <span className="font-mono text-muted">{t.requested}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const statusRows = [...seq.stats.entries()]
    .map(([id, s]) => ({ ...s, name: seq.teams.find((t) => t.id === id)?.name ?? `#${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-12">
      <header className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold">Sequence</h1>
        <p className="text-muted">
          Frozen at <span className="font-mono text-fg">{seq.frozenAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span> with{" "}
          {seq.frozenTeamIds.length} teams. Seed{" "}
          <span className="break-all font-mono text-fg">{seq.seed}</span>, SHA-256{" "}
          <span className="break-all font-mono text-fg">{seq.seedHash}</span> as published before the
          freeze.
        </p>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-mono text-xs">how to verify</summary>
          <p className="mt-2">
            Round <i>n</i> is a Fisher–Yates shuffle with{" "}
            <code>rng = seedrandom(&quot;&lt;seed&gt;:&lt;n−1&gt;&quot;)</code> (round 1 uses{" "}
            <code>&quot;&lt;seed&gt;:0&quot;</code>): for <i>i</i> from the last index down to 1, swap{" "}
            <code>a[i]</code> with <code>a[floor(rng() · (i+1))]</code>. It runs over the CTFtime ids
            of all teams registered before the freeze, sorted ascending; each
            keeps that place for the vouchers it asked for at the freeze. After them come teams
            registered later (<span className="font-mono text-warn">late</span>) and vouchers added
            by raising the request after the freeze (<span className="font-mono text-warn">extra</span>),
            ordered by when that happened. Up to {config.perRound} vouchers per team per round.
          </p>
          <p className="mt-2">
            Check the seed with <code>printf %s &apos;&lt;seed&gt;&apos; | sha256sum</code>. The CTFtime ids
            registered before the freeze, sorted (banned teams stay in the shuffle and are skipped):
          </p>
          <p className="mt-1 break-all font-mono text-xs text-fg">{seq.frozenTeamIds.join(", ")}</p>
        </details>
      </header>

      <div className="grid gap-x-10 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
        {seq.rounds.map((entries, r) => (
          <section key={r}>
            <h2 className="label mb-3 flex justify-between">
              <span>round {r + 1}</span>
              <span>
                {entries.filter((e) => e.got === e.want).length}/{entries.length} done
              </span>
            </h2>
            <ol className="border-t border-rule text-sm">
              {entries.map((e, i) => (
                <li
                  key={`${e.teamId}-${e.tag}`}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-2 border-b border-rule py-1.5"
                >
                  <span className="font-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">
                    {e.name}
                    {e.tag && <span className="ml-2 font-mono text-xs text-warn">{e.tag}</span>}
                  </span>
                  <Blocks got={e.got} want={e.want} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {statusRows.length > 0 && (
        <section>
          <h2 className="label mb-3">vouchers per team</h2>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-rule">
                  <th className="py-1.5 pr-4 font-normal">team</th>
                  <th className="py-1.5 pr-4 text-right font-normal">sent</th>
                  <th className="py-1.5 pr-4 text-right font-normal">confirmed</th>
                  <th className="py-1.5 pr-4 text-right font-normal">came back</th>
                  <th className="py-1.5 text-right font-normal">flagged</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((s) => (
                  <tr key={s.name} className="border-b border-rule">
                    <td className="py-1.5 pr-4 font-sans">{s.name}</td>
                    <td className="py-1.5 pr-4 text-right">{s.sent}</td>
                    <td className="py-1.5 pr-4 text-right">{s.confirmed}</td>
                    <td className={`py-1.5 pr-4 text-right ${s.replicated ? "text-ok" : "text-muted"}`}>{s.replicated}</td>
                    <td className={`py-1.5 text-right ${s.flagged ? "text-bad" : "text-muted"}`}>
                      {s.flagged}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
