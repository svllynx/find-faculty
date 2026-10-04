import Link from "next/link";
import { getDb } from "@/lib/db";
import { listDepartments, openNowCount } from "@/lib/faculty";
import { campusNow, WEEKDAYS, formatMinute } from "@/lib/time";
import {
  MagnifyingGlass,
  MapTrifold,
  SignIn,
  CheckCircle,
  Timer,
  XCircle,
  CalendarX,
} from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  {
    href: "/search",
    icon: MagnifyingGlass,
    title: "Search the directory",
    body: "Find a professor by name, department, subject, room, or who is free right now.",
  },
  {
    href: "/map",
    icon: MapTrifold,
    title: "Building map",
    body: "The inside of the CCIS building, floor by floor — tap a room to see whose office it is.",
  },
  {
    href: "/login",
    icon: SignIn,
    title: "Faculty & staff sign in",
    body: "Publish your office hours, post your availability, and manage appointment requests.",
  },
] as const;

const BADGE_SOURCES = [
  {
    icon: CheckCircle,
    tone: "text-open",
    label: "Available / Unavailable",
    body: "The faculty member posted it themselves. “They said so.”",
  },
  {
    icon: Timer,
    tone: "text-soon",
    label: "In office hours / consultation hours / class",
    body: "Their published schedule has a block running now. Expected, not confirmed.",
  },
  {
    icon: CalendarX,
    tone: "text-shut",
    label: "Away until a date",
    body: "A posted absence longer than a day, with the date they are back.",
  },
  {
    icon: XCircle,
    tone: "text-muted",
    label: "Outside hours / no schedule",
    body: "Nothing is being claimed. Nothing is sensed, scanned, or inferred — ever.",
  },
] as const;

export default async function HomePage() {
  const db = getDb();
  const now = new Date();
  const clock = campusNow(now);
  const openCount = openNowCount(db, now);
  const departments = listDepartments(db);

  return (
    <div className="relative overflow-x-clip">
      {/* Clipped at this (narrow) wrapper, not just relying on the page-level
          safety net — a glow this size is naturally wider than a phone
          viewport by design, so it must never be the thing that makes the
          page itself scrollable sideways. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand-soft/60 blur-3xl"
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <span data-hero-reveal className="eyebrow">
          CCIS faculty directory
        </span>
        <h1
          data-hero-reveal
          className="mx-auto mt-5 max-w-3xl text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-tight"
        >
          Find your professor&rsquo;s office, hours, and the fastest way there.
        </h1>
        <p data-hero-reveal className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          One search instead of asking classmates or checking the CCIS bulletin board — office,
          office hours, live availability and a floor plan, together.
        </p>

        <div data-hero-reveal className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/search" className="btn btn-primary px-6 py-3 text-base">
            Search the directory
          </Link>
          <Link href="/map" className="btn btn-quiet px-6 py-3 text-base">
            View the building map
          </Link>
        </div>

        <p data-hero-reveal className="mt-5 text-sm text-muted">
          {WEEKDAYS[clock.weekday]}, {formatMinute(clock.minute)} on campus ·{" "}
          <Link href="/search?openNow=1" className="font-semibold text-brand hover:text-brand-ink">
            {openCount} faculty available right now
          </Link>
        </p>
      </section>

      {/* ── Quick links ───────────────────────────────────────────────── */}
      <section
        data-reveal-group
        className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3 sm:px-6"
      >
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-reveal
            className="group card hover-lift block p-5"
          >
            <span aria-hidden="true" className="btn-icon h-11 w-11 text-brand">
              <item.icon size={22} weight="light" />
            </span>
            <h2 className="mt-4 flex items-center gap-2 text-base font-semibold">
              {item.title}
              <span aria-hidden="true" className="btn-icon h-6 w-6 text-xs">
                →
              </span>
            </h2>
            <p className="mt-1.5 text-sm text-muted">{item.body}</p>
          </Link>
        ))}
      </section>

      {/* ── What FIND is ──────────────────────────────────────────────── */}
      <section className="mx-auto mt-20 max-w-4xl px-4 sm:px-6">
        <span className="eyebrow">Privacy by design</span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          An information system, not a tracking system
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          FIND will never claim to know that someone is physically in a room. There is no sensor,
          no check-in scan, no device lookup. Every badge states exactly where its claim came from,
          so you can judge how much to trust it before walking across campus.
        </p>

        <div data-reveal-group className="mt-8 grid gap-4 sm:grid-cols-2">
          {BADGE_SOURCES.map((item) => (
            <div key={item.label} data-reveal className="card hover-lift p-4">
              <span aria-hidden="true" className={`btn-icon h-10 w-10 ${item.tone}`}>
                <item.icon size={20} weight="light" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{item.label}</h3>
              <p className="mt-1.5 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Departments ───────────────────────────────────────────────── */}
      {departments.length > 0 && (
        <section className="mx-auto mb-20 mt-16 max-w-4xl px-4 sm:px-6">
          <h2 className="text-lg font-semibold">Browse by department</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {departments.map((d) => (
              <Link
                key={d.code}
                href={`/search?department=${d.code}`}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-soft transition-all duration-300 ease-[var(--ease-premium,cubic-bezier(.32,.72,0,1))] hover:-translate-y-px hover:bg-raise"
              >
                {d.name} <span className="text-muted">({d.code})</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
