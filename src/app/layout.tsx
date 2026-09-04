import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { usingEphemeralDb } from "@/lib/db";
import SignOutButton from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: {
    default: "FIND — Faculty Information & Navigate Direction",
    template: "%s · FIND",
  },
  description:
    "Search for a professor and see their office, office hours and availability in one place.",
};

function Mark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-[15px] font-bold text-white"
      >
        F
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-tight text-ink">FIND</span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
          Faculty Directory
        </span>
      </span>
    </span>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const ephemeral = usingEphemeralDb();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded bg-brand px-3 py-2 text-sm font-semibold text-white"
        >
          Skip to content
        </a>

        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
            <Link href="/" className="shrink-0" aria-label="FIND home">
              <Mark />
            </Link>

            <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-2 font-medium text-ink-soft hover:bg-raise"
              >
                Search
              </Link>
              <Link
                href="/map"
                className="rounded-md px-3 py-2 font-medium text-ink-soft hover:bg-raise"
              >
                Campus map
              </Link>
              {user ? (
                <>
                  <Link
                    href={user.role === "admin" ? "/admin" : "/dashboard"}
                    className="rounded-md px-3 py-2 font-medium text-ink-soft hover:bg-raise"
                  >
                    {user.role === "admin" ? "Manage records" : "My office hours"}
                  </Link>
                  <span className="ml-1 hidden text-xs text-muted sm:inline">
                    {user.display_name || user.email}
                  </span>
                  <SignOutButton />
                </>
              ) : (
                <Link href="/login" className="btn btn-quiet ml-1 py-1.5 text-sm">
                  Faculty sign in
                </Link>
              )}
            </nav>
          </div>
        </header>

        {ephemeral && (
          <p className="border-b border-soon/30 bg-soon-soft px-4 py-2 text-center text-[13px] text-soon">
            <strong className="font-semibold">Public demo.</strong> This deployment keeps its data in
            temporary storage, so anything you change here resets on its own. Sign in and edit
            freely — you cannot break it.
          </p>
        )}

        <main id="main">{children}</main>

        <footer className="mt-16 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
            <p className="max-w-2xl">
              <strong className="font-semibold text-ink-soft">
                FIND does not track anyone&rsquo;s location.
              </strong>{" "}
              Every office hour and availability status you see here was published by that faculty
              member or by their department. Nothing is sensed, scanned, or inferred.
            </p>
            <p className="mt-3">
              FIND — Faculty Information &amp; Navigate Direction · a campus information and
              scheduling system.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
