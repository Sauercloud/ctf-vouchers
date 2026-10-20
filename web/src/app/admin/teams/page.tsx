import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ActionForm, ErrorBanner, fmt, inputClass } from "../ui";

export default async function AdminTeams({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;
  const teams = await prisma.team.findMany({
    orderBy: [{ banned: "desc" }, { registeredAt: "asc" }],
    include: { _count: { select: { assignments: { where: { slotRefunded: false } } } } },
  });
  const back = "/admin/teams";

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} />
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Ban a team</h1>
        <p className="text-sm text-muted">Works for teams that have not registered yet, too.</p>
        <ActionForm action="team-ban" back={back} label="ban" danger>
          <input name="id" placeholder="CTFtime id" required className={inputClass} />
          <input name="name" placeholder="name (optional)" className={inputClass} />
          <input name="reason" placeholder="reason" className={inputClass} />
        </ActionForm>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="p-1">Id</th>
              <th className="p-1">Name</th>
              <th className="p-1">Contact</th>
              <th className="p-1">Requested</th>
              <th className="p-1">Allocated</th>
              <th className="p-1">Registered</th>
              <th className="p-1"></th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className={`border-t border-rule ${t.banned ? "text-bad" : ""}`}>
                <td className="p-1">
                  <a href={`https://ctftime.org/team/${t.id}`} className="underline">
                    {t.id}
                  </a>
                </td>
                <td className="p-1">{t.name}</td>
                <td className="p-1">{t.contactEmail}</td>
                <td className="p-1">{t.requested}</td>
                <td className="p-1">{t._count.assignments}</td>
                <td className="p-1">{fmt(t.registeredAt)}</td>
                <td className="p-1">
                  {t.banned ? (
                    <span className="flex gap-2 items-center">
                      {t.banReason}
                      <ActionForm action="team-unban" back={back} fields={{ id: String(t.id) }} label="unban" />
                    </span>
                  ) : (
                    <ActionForm action="team-ban" back={back} fields={{ id: String(t.id) }} label="ban" danger>
                      <input name="reason" placeholder="reason" className={inputClass} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
