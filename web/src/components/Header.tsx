"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      className={`no-underline hover:text-fg ${active ? "text-fg" : "text-muted"}`}
    >
      {active ? `[${children}]` : children}
    </Link>
  );
}

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-rule py-4 font-mono text-sm">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <Link href="/" className="font-semibold text-fg no-underline">
          ctf-vouchers<span className="text-accent">/</span>40c3
        </Link>
        <NavLink href="/sequence">sequence</NavLink>
        {status === "authenticated" && <NavLink href="/dashboard">dashboard</NavLink>}
      </div>
      <div className="text-muted">
        {status === "loading" ? (
          <span>…</span>
        ) : session ? (
          <span className="flex items-baseline gap-4">
            <span>{session.user?.name}</span>
            <button onClick={() => signOut()} className="cursor-pointer hover:text-fg">
              sign out
            </button>
          </span>
        ) : (
          <button
            onClick={() => signIn("ctftime", { callbackUrl: "/dashboard" })}
            className="cursor-pointer text-fg hover:text-accent"
          >
            sign in with ctftime →
          </button>
        )}
      </div>
    </header>
  );
}
