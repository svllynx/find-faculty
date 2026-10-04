import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { usingEphemeralDb } from "@/lib/db";
import SignOutButton from "@/components/SignOutButton";
import ScrollReveal from "@/components/ScrollReveal";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

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
 * The supplied wordmark is light blue with black artwork — drawn for a light
 * surface, so it washed out directly on the brand bar. Rather than box it in
 * a white card, find-logo-header.png recolours every opaque pixel to white
 * (alpha untouched, so the edges stay soft) and sits straight on the navy,
 * blending into the header instead of sitting on top of it.
 */
function Masthead() {
  return (
    <Link
      href="/"
      aria-label="FIND — home"
      className="inline-flex items-center transition-transform duration-300 ease-[var(--ease-premium,cubic-bezier(.32,.72,0,1))] hover:-translate-y-0.5"
    >
      <Image
        src="/find-logo-header.png"
        alt="FIND — Faculty Information & Navigate Direction"
        width={481}
        height={269}
        priority
        className="h-14 w-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] sm:h-16"
      />
    </Link>
  );
}

function NavLinks({
  user,
  linkClassName,
}: {
  user: { role: string } | null;
  linkClassName: string;
}) {
  return (
    <>
      <Link href="/search" className={linkClassName}>
        Search
      </Link>
      <Link href="/map" className={linkClassName}>
        Building map
      </Link>
      {user && (
        <Link href={user.role === "admin" ? "/admin" : "/dashboard"} className={linkClassName}>
          {user.role === "admin" ? "Manage records" : "My office hours"}
        </Link>
      )}
    </>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const ephemeral = usingEphemeralDb();

  const navLink =
    "rounded-full px-3.5 py-1.5 text-sm font-medium text-white/85 transition-all duration-300 ease-[var(--ease-premium,cubic-bezier(.32,.72,0,1))] hover:-translate-y-px hover:bg-white/15 hover:text-white";
  const sheetLink =
    "rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-raise";

  return (
    <html lang="en" className={jakarta.variable}>
      {/* overflow-x-clip is a safety net, not decoration: a purely decorative
          blurred glow (see page.tsx hero spotlights) is sized generously and
          centred with a negative translate, which is exactly the shape of bug
          that creates real horizontal scroll on narrow viewports if nothing
          clips it. This guarantees no page can scroll sideways. */}
      <body className="min-h-screen overflow-x-clip">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded bg-white px-3 py-2 text-sm font-semibold text-brand"
        >
          Skip to content
        </a>

        <header className="relative overflow-hidden bg-brand grain">
          {/* Ambient mesh-glow + grain (the latter via .grain on <header>): purely decorative. */}
          <div aria-hidden="true" className="mesh-glow" />

          <div className="relative z-10">
            {/* The mark is centred on its own row, so it reads as the site's name
                rather than as the first item in a navigation list. */}
            <div data-hero-reveal className="flex justify-center px-4 pb-3 pt-5">
              <Masthead />
            </div>

            <p data-hero-reveal className="px-4 pb-4 text-center text-[13px] text-white/75">
              Faculty Information &amp; Navigate Direction ·{" "}
              <span className="font-semibold text-white">CCIS</span>
            </p>

            {/* Desktop / tablet: the nav row itself reads as a floating pill,
                detached visually from the bar via its own rounded-full hairline. */}
            <nav
              aria-label="Main"
              className="hidden items-center justify-center gap-1 border-t border-white/15 px-4 py-2 sm:flex"
            >
              <NavLinks user={user} linkClassName={navLink} />
              {user ? (
                <>
                  <span className="mx-1 hidden text-xs text-white/60 sm:inline">
                    {user.display_name || user.email}
                  </span>
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/login"
                  className="ml-1 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-px hover:bg-white/25"
                >
                  Faculty sign in
                </Link>
              )}
            </nav>

            {/* Mobile: a native <details> disclosure, so the menu opens and the
                hamburger morphs into an "X" with zero JavaScript. */}
            <details className="nav-toggle relative border-t border-white/15 sm:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white/90 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="relative flex h-4 w-5 flex-col justify-between">
                  <span className="nav-line h-[1.5px] w-full origin-center rounded-full bg-white transition-transform duration-300 ease-[var(--ease-premium,cubic-bezier(.32,.72,0,1))]" />
                  <span className="nav-line h-[1.5px] w-full origin-center rounded-full bg-white transition-transform duration-300 ease-[var(--ease-premium,cubic-bezier(.32,.72,0,1))]" />
                </span>
                Menu
              </summary>
            </details>
            <div className="nav-sheet overflow-hidden px-4 sm:hidden">
              <div className="flex flex-col gap-1 rounded-2xl bg-white p-2 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
                <NavLinks user={user} linkClassName={sheetLink} />
                {user ? (
                  <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2.5">
                    <span className="truncate text-xs text-muted">
                      {user.display_name || user.email}
                    </span>
                    <SignOutButton />
                  </div>
                ) : (
                  <Link href="/login" className="rounded-xl bg-brand px-3.5 py-2.5 text-sm font-semibold text-white">
                    Faculty sign in
                  </Link>
                )}
              </div>
            </div>
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
          <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">
            <span className="eyebrow">Privacy by design</span>
            <p className="mt-3 max-w-2xl text-ink-soft">
              <strong className="font-semibold text-ink">
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

        <ScrollReveal />
      </body>
    </html>
  );
}
