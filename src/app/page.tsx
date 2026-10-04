import Link from "next/link";
import { getDb } from "@/lib/db";
import { listDepartments, listFloors, openNowCount, searchFaculty } from "@/lib/faculty";
import { campusNow, WEEKDAYS, formatMinute } from "@/lib/time";
import { isOpenNow } from "@/lib/availability";
import SearchForm from "@/components/SearchForm";
import FacultyCard from "@/components/FacultyCard";
import {
  CheckCircle,
  Timer,
  XCircle,
  CalendarX,
} from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  department?: string;
  floor?: string;
  day?: string;
  openNow?: string;
};

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const db = getDb();
  const now = new Date();
  const clock = campusNow(now);

  const intParam = (raw: string | undefined, min: number, max: number) => {
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
  };
  const filters = {
    q: params.q?.trim() || undefined,
    department: params.department || undefined,
    floor: intParam(params.floor, 0, 99),
    weekday: intParam(params.day, 0, 6),
    openNow: params.openNow === "1",
  };

  const results = searchFaculty(db, filters, now);
  const departments = listDepartments(db);
  const floors = listFloors(db);
  const hasQuery = Boolean(
    filters.q ||
      filters.department ||
      filters.floor !== undefined ||
      filters.weekday !== undefined ||
      filters.openNow,
  );

  const openCount = openNowCount(db, now);

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      {/* A soft spotlight behind the hero, echoing the masthead's glow without
          competing with it — purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-brand-soft/60 blur-3xl"
      />

      <section className="mb-10 max-w-4xl">
        <span data-hero-reveal className="eyebrow">
          CCIS faculty directory
        </span>
        <h1
          data-hero-reveal
          className="mt-5 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.05] tracking-tight"
        >
          Where and when can I find my professor?
        </h1>
        <p data-hero-reveal className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
          Search once and get the office, the office hours and directions to the door together —
          instead of asking classmates or checking the CCIS bulletin board.
        </p>
        <p data-hero-reveal className="mt-4 text-sm text-muted">
          {WEEKDAYS[clock.weekday]}, {formatMinute(clock.minute)} on campus ·{" "}
          <Link href="/?openNow=1" className="font-semibold text-brand hover:text-brand-ink">
            {openCount} faculty available right now
          </Link>
        </p>
      </section>

      <section data-hero-reveal className="bezel-shell mb-10">
        <div className="bezel-core p-4 sm:p-5">
          <SearchForm
            departments={departments}
            floors={floors}
            initial={{
              q: filters.q ?? "",
              department: filters.department ?? "",
              floor: filters.floor === undefined ? "" : String(filters.floor),
              day: filters.weekday === undefined ? "" : String(filters.weekday),
              openNow: filters.openNow,
            }}
          />
        </div>
      </section>

      <section aria-labelledby="results-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-heading" className="text-lg font-semibold">
            {hasQuery ? "Search results" : "All CCIS faculty"}
          </h2>
          <p aria-live="polite" className="text-sm text-muted">
            {results.length} {results.length === 1 ? "faculty member" : "faculty members"}
            {filters.openNow ? " available now" : ""}
            {results.length > 0 && !filters.openNow
              ? ` · ${results.filter((r) => isOpenNow(r.availability)).length} available now`
              : ""}
          </p>
        </div>

        {results.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="text-base font-semibold text-ink">No faculty matched that search.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Try a surname on its own, a subject code, or a department. If you are sure the
              professor teaches here, their record may not be in FIND yet — tell the department
              office so they can add it.
            </p>
            <Link href="/" className="btn btn-quiet mt-5">
              Clear the search
            </Link>
          </div>
        ) : (
          <ul data-reveal-group className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((faculty) => (
              <FacultyCard key={faculty.id} faculty={faculty} reveal />
            ))}
          </ul>
        )}
      </section>

      <section data-reveal-group className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: CheckCircle,
            tone: "text-open",
            title: "Available",
            body: "The faculty member posted that they are in and free for consultation right now.",
          },
          {
            icon: Timer,
            tone: "text-soon",
            title: "In office hours",
            body: "Their published schedule has a block running now. Expected in office — worth the walk.",
          },
          {
            icon: XCircle,
            tone: "text-shut",
            title: "Unavailable",
            body: "They posted that they are out, so you know not to make the trip.",
          },
          {
            icon: CalendarX,
            tone: "text-muted",
            title: "Away until a date",
            body: "A longer absence — a seminar, leave, an accreditation visit — with the date they are back.",
          },
        ].map((item) => (
          <article key={item.title} data-reveal className="card hover-lift p-4">
            <span aria-hidden="true" className={`btn-icon h-10 w-10 ${item.tone}`}>
              <item.icon size={20} weight="light" />
            </span>
            <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
