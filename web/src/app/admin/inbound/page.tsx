import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { classifyRecipient, type Headers } from "@/lib/parse";
import { config } from "@/lib/config";
import { ActionForm, ErrorBanner, MailView, fmt, inputClass } from "../ui";

export default async function AdminInbound({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;
  const mails = await prisma.inboundMail.findMany({
    orderBy: { receivedAt: "desc" },
    take: 200,
    include: { vouchers: true },
  });
  const back = "/admin/inbound";

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} />
      <h1 className="text-xl font-semibold">Inbound mails</h1>
      <ul className="space-y-3">
        {mails.map((m) => {
          const r = classifyRecipient(m.recipient.split(",")[0], config.mailDomain, config.seedSecret);
          const token = r.kind === "replica" || r.kind === "confirm" ? r.token : "";
          return (
            <li key={m.id} className="border border-rule p-3 text-sm space-y-2">
              <div className="flex flex-wrap gap-x-4">
                <span
                  className={
                    m.status === "PROCESSED" ? "text-ok" : m.status === "UNMATCHED" || m.status === "IGNORED" ? "text-muted" : "text-bad"
                  }
                >
                  {m.status}
                </span>
                <span>{fmt(m.receivedAt)}</span>
                <span className="text-muted">{r.kind}</span>
              </div>
              {m.note && <div className="text-muted">{m.note}</div>}
              {m.vouchers.length > 0 && (
                <div className="font-mono text-muted">{m.vouchers.map((v) => v.code).join(", ")}</div>
              )}
              <MailView
                fields={[
                  ["from", m.from],
                  ["sender", m.sender !== m.from ? m.sender : null],
                  ["to", m.recipient],
                  ["subject", m.subject],
                  ["message-id", m.messageId],
                ]}
                body={m.bodyPlain}
                rawHeaders={m.headers as Headers}
              />
              {m.vouchers
                .filter((v) => v.held)
                .map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="font-mono">{v.code}</span>
                    <span className="text-muted">held: {v.heldReason}</span>
                    <ActionForm action="voucher-release" back={back} fields={{ id: v.id }} label="release" />
                  </div>
                ))}
              {m.status !== "PROCESSED" && m.vouchers.length === 0 && (
                <div className="pt-1">
                  <ActionForm action="inbound-code" back={back} fields={{ mailId: m.id }} label="enter code">
                    <input name="code" placeholder="voucher code" className={inputClass} />
                    <input
                      name="token"
                      defaultValue={r.kind === "replica" ? token : ""}
                      placeholder="replica token (empty = seed)"
                      className={inputClass}
                    />
                  </ActionForm>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
