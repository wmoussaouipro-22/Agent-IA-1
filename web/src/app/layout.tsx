import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eco-Locaux · Prospection",
  description: "Suivi de la prospection des commerces de proximité",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="fr">
      <body>
        {user && (
          <header className="topbar">
            <Link href="/commerces" className="brand">
              Eco-Locaux
            </Link>
            <nav>
              <Link href="/commerces">Commerces</Link>
              <Link href="/relances">Relances</Link>
            </nav>
            <form action={logout} className="who">
              <span>{user.email}</span>
              <button type="submit" className="ghost">
                Se déconnecter
              </button>
            </form>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
