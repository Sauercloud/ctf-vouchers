import Link from "next/link";

// Small building blocks for the admin pages. Forms post to /api/admin/<action>.

export function ActionForm({
  action,
  back,
  fields = {},
  label,
  danger,
  children,
}: {
  action: string;
  back: string;
  fields?: Record<string, string>;
  label: string;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <form method="post" action={`/api/admin/${action}`} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="back" value={back} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <button type="submit" className={`btn-sm ${danger ? "hover:border-bad hover:text-bad" : ""}`}>
        {label}
      </button>
    </form>
  );
}

export const inputClass = "px-2! py-1! text-xs!";

export function AdminNav() {
  const links = [
    ["/admin", "overview"],
    ["/admin/teams", "teams"],
    ["/admin/assignments", "assignments"],
    ["/admin/inbound", "inbound"],
    ["/admin/outbox", "outbox"],
  ];
  return (
    <nav className="mb-8 flex flex-wrap gap-x-6 gap-y-1 border-b border-rule pb-3 font-mono text-sm">
      <span className="text-accent">admin</span>
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="text-muted no-underline hover:text-fg">
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="mb-6 border-l-2 border-bad pl-4 font-mono text-sm text-bad">{error}</div>;
}

// A whole mail: the main header fields, the body and optionally every raw header.
export function MailView({
  fields,
  body,
  rawHeaders,
}: {
  fields: [string, string | null | undefined][];
  body: string;
  rawHeaders?: Record<string, string[]>;
}) {
  return (
    <div className="border border-rule bg-surface font-mono text-xs">
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-0.5 border-b border-rule px-3 py-2">
        {fields
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
      </dl>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-2 font-mono">
        {body || <span className="text-muted">(empty body)</span>}
      </pre>
      {rawHeaders && Object.keys(rawHeaders).length > 0 && (
        <details className="border-t border-rule px-3 py-2">
          <summary className="cursor-pointer text-muted">all headers</summary>
          <dl className="mt-2 grid grid-cols-[minmax(6rem,14rem)_1fr] gap-x-3 gap-y-0.5">
            {Object.entries(rawHeaders).flatMap(([k, values]) =>
              values.map((v, i) => (
                <div key={`${k}-${i}`} className="contents">
                  <dt className="break-all text-muted">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              )),
            )}
          </dl>
        </details>
      )}
    </div>
  );
}

export const fmt = (d: Date | null | undefined) =>
  d ? d.toISOString().replace("T", " ").slice(0, 16) : "–";
