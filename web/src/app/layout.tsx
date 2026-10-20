import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import Header from "@/components/Header";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "ctf-vouchers · 40C3",
  description: "40C3 voucher distribution for the CTF community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-8">
            <Header />
            <main className="flex-grow py-10">{children}</main>
            <footer className="flex flex-wrap justify-between gap-2 border-t border-rule py-4 font-mono text-xs text-muted">
              <span>run by CTF people for CTF people</span>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
