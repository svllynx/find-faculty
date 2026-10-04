import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listDepartments, listFloors, searchFaculty } from "@/lib/faculty";
import { isOpenNow, parseScheduleType } from "@/lib/availability";
import SearchForm from "@/components/SearchForm";
import FacultyCard from "@/components/FacultyCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Search CCIS faculty by name, department, subject, room or availability.",
};

type Search = {
  q?: string;
  department?: string;
  floor?: string;
  day?: string;
  type?: string;
  openNow?: string;
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const db = getDb();
  const now = new Date();

  const intParam = (raw: string | undefined, min: number, max: number) => {
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
  };
  const scheduleType = parseScheduleType(params.type);
  const filters = {
    q: params.q?.trim() || undefined,
    department: params.department || undefined,
    floor: intParam(params.floor, 0, 99),
    weekday: intParam(params.day, 0, 6),
    scheduleType,
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
      filters.scheduleType ||
      filters.openNow,
  );

  return (
    <div className="relative mx-auto max-w-6xl overflow-x-clip px-4 py-10 sm:px-6 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-[24rem] w-[52rem] -translate-x-1/2 rounded-full bg-brand-soft/50 blur-3xl"
      />

      <section className="mb-8 max-w-3xl">
        <span data-hero-reveal className="eyebrow">
          Search
        </span>
        <h1 data-hero-reveal className="mt-4 text-[clamp(2rem,4.5vw,3rem)] leading-[1.08] tracking-tight">
          Search CCIS faculty
        </h1>
        <p data-hero-reveal className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
          By name, department, subject, room, or who is free right now.
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
              type: filters.scheduleType ?? "",
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
            <Link href="/search" className="btn btn-quiet mt-5">
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
    </div>
  );
}
