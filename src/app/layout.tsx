import type { Metadata } from "next";
import Image from "next/image";
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
    "Search for a CCIS professor and see their office, office hours and availability in one place.",
};

/**
 * The masthead.
 *
 * The wordmark is light blue with black artwork — drawn for a light surface — so
 * on the blue bar it sits in a white card rather than being recoloured. That
 * keeps the logo exactly as supplied and keeps it legible.
 */
function Masthead() {
  return (
    <Link
      href="/"
      aria-label="FIND — home"
      className="inline-flex items-center rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow"
    >
      <Image
        src="/find-logo.png"
        alt="FIND — Faculty Information & Navigate Direction"
        width={481}
        height={269}
        priority
        className="h-11 w-auto sm:h-12"
      />
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const ephemeral = usingEphemeralDb();

  const navLink =
    "rounded-md px-3 py-1.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white";

  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded bg-white px-3 py-2 text-sm font-semibold text-brand"
        >
          Skip to content
        </a>

        <header className="bg-brand">
          {/* The mark is centred on its own row, so it reads as the site's name
              rather than as the first item in a navigation list. */}
          <div className="flex justify-center px-4 pb-3 pt-5">
            <Masthead />
          </div>

          <p className="px-4 pb-4 text-center text-[13px] text-white/75">
            Faculty Information &amp; Navigate Direction ·{" "}
            <span className="font-semibold text-white">CCIS</span>
          </p>

          <nav
            aria-label="Main"
            className="flex flex-wrap items-center justify-center gap-1 border-t border-white/15 px-4 py-2"
          >
            <Link href="/" className={navLink}>
              Search
            </Link>
            <Link href="/map" className={navLink}>
              Building map
            </Link>
            {user ? (
              <>
                <Link href={user.role === "admin" ? "/admin" : "/dashboard"} className={navLink}>
                  {user.role === "admin" ? "Manage records" : "My office hours"}
                </Link>
                <span className="mx-1 hidden text-xs text-white/60 sm:inline">
                  {user.display_name || user.email}
                </span>
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="ml-1 rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
              >
                Faculty sign in
              </Link>
            )}
          </nav>
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
              FIND — Faculty Information &amp; Navigate Direction · College of Computer Science
              (CCIS) faculty directory.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
