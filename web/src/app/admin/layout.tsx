import { requireAdminPage } from "@/lib/admin";
import { AdminNav } from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}
