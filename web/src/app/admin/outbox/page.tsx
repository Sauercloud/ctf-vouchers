import { requireAdminPage } from "@/lib/admin";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { ActionForm, ErrorBanner, MailView, fmt } from "../ui";

export default async function AdminOutbox({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;
  const mails = await prisma.outboundMail.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const back = "/admin/outbox";

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} />
      <h1 className="text-xl font-semibold">Outbox</h1>
      <ul className="space-y-3">
        {mails.map((m) => (
          <li key={m.id} className="border border-rule p-3 text-sm space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className={m.status === "FAILED" ? "text-bad" : m.status === "SENT" ? "text-ok" : m.status === "CANCELLED" ? "text-muted" : "text-warn"}>
                {m.status}
              </span>
              <span className="text-muted">{m.kind.toLowerCase().replace("_", " ")}</span>
              <span>created {fmt(m.createdAt)}</span>
              <span>sent {fmt(m.sentAt)}</span>
              <span className="text-muted">
                {m.attempts} attempt{m.attempts === 1 ? "" : "s"}
              </span>
              {m.status === "FAILED" && (
                <ActionForm action="outbox-retry" back={back} fields={{ id: m.id }} label="retry" />
              )}
            </div>
            {m.lastError && <div className="break-all font-mono text-xs text-bad">{m.lastError}</div>}
            <MailView
              fields={[
                ["from", config.mailFrom],
                ["to", m.to],
                ["reply-to", m.replyTo],
                ["subject", m.subject],
                ["mailgun id", m.mailgunId],
              ]}
              body={m.text}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
