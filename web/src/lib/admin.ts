import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";

// nginx protects /admin and /api/admin with basic auth and sets
// X-Admin-User; every other location clears the header.
export async function adminUser(): Promise<string | null> {
  if (config.adminDevBypass) return "dev";
  const user = (await headers()).get("x-admin-user");
  return user ? user : null;
}

// Browsers send cached basic auth credentials with cross-site form posts too,
// so admin mutations must come from our own pages.
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin || !URL.canParse(origin)) return false;
  return new URL(origin).origin === new URL(config.baseUrl).origin;
}

export async function requireAdminPage() {
  const user = await adminUser();
  if (!user) notFound();
  return user;
}
