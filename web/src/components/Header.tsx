"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import React from "react";

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="bg-gray-800 shadow-md">
      <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-2xl font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            CTF-Vouchers
          </Link>
          <Link
            href="/about"
            className="text-gray-300 hover:text-white transition-colors"
          >
            About
          </Link>
          {status === "authenticated" && (
            <Link
              href="/dashboard"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="h-10 w-24 bg-gray-700 rounded-md animate-pulse"></div>
          ) : session ? (
            <div className="flex items-center gap-4">
              <span className="text-gray-400 hidden sm:block">
                {session.user?.name}
              </span>
              <button
                onClick={() => signOut()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("ctftime")}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
