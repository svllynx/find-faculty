import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getFaculty, listBuildings } from "@/lib/faculty";
import { campusNow, humanizeGap, formatRange, WEEKDAYS } from "@/lib/time";
import { currentUser, canEditFaculty } from "@/lib/auth";
import StatusBadge, { SourceNote } from "@/components/StatusBadge";
import HoursTable from "@/components/HoursTable";
import DirectionsPanel from "@/components/DirectionsPanel";
import CampusMap from "@/components/CampusMap";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const id = Number((await params).id);
  const faculty = Number.isInteger(id) ? getFaculty(getDb(), id) : null;
  if (!faculty) return { title: "Faculty member not found" };
  return {
    title: faculty.full_name,
    description: `${faculty.full_name} — ${faculty.officeLabel}. Office hours and availability.`,
  };
}

export default async function FacultyProfilePage({ params }: Params) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = getDb();
  const now = new Date();
  const faculty = getFaculty(db, id, now);
  if (!faculty || !faculty.is_active) notFound();

  const user = await currentUser();
  const mayEdit = canEditFaculty(user, faculty.id);
  const clock = campusNow(now);
  const { availability } = faculty;
  const next = availability.nextWindow;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <Link href="/" className="text-muted hover:text-brand">
          Faculty search
        </Link>
        <span aria-hidden="true" className="mx-2 text-line">
          /
        </span>
        <span className="text-ink-soft">{faculty.full_name}</span>
      </nav>

      {/* ── Identity + status ─────────────────────────────────────────────── */}
      <header className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{faculty.full_name}</h1>
            <p className="mt-1 text-[15px] text-ink-soft">
              {faculty.title}
              {faculty.title && faculty.department_name ? " · " : ""}
              {faculty.department_name}
            </p>
          </div>

          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <StatusBadge availability={availability} />
            <SourceNote availability={availability} />
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-canvas px-4 py-3 text-sm text-ink-soft">
          {availability.detail}
        </p>

        {faculty.consultation_note && (
          <p className="mt-3 border-l-2 border-accent bg-accent-soft px-4 py-2.5 text-sm text-ink-soft">
            <span className="font-semibold">A note from {firstName(faculty.full_name)}: </span>
            {faculty.consultation_note}
          </p>
        )}

        {mayEdit && (
          <p className="mt-4 text-sm">
            <Link
              href={user?.role === "admin" ? `/admin?faculty=${faculty.id}` : "/dashboard"}
              className="font-semibold text-brand hover:text-brand-ink"
            >
              Update this record
              <span aria-hidden="true"> →</span>
            </Link>
          </p>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Office + hours ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="office-heading">
            <h2 id="office-heading" className="text-lg font-semibold">
              Office
            </h2>
            <dl className="mt-3 divide-y divide-line text-sm">
              <Row label="Building">{faculty.building_name ?? "Not assigned"}</Row>
              <Row label="Room">{faculty.room ? `Room ${faculty.room}` : "Not assigned"}</Row>
              {faculty.floor && <Row label="Floor">{faculty.floor}</Row>}
              <Row label="Department">{faculty.department_name ?? "—"}</Row>
              {faculty.email && (
                <Row label="Email">
                  <a href={`mailto:${faculty.email}`} className="text-brand hover:text-brand-ink">
                    {faculty.email}
                  </a>
                </Row>
              )}
              {faculty.phone && <Row label="Phone">{faculty.phone}</Row>}
              {faculty.subjectList.length > 0 && (
                <Row label="Subjects">{faculty.subjectList.join(", ")}</Row>
              )}
            </dl>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="hours-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="hours-heading" className="text-lg font-semibold">
                Office hours
              </h2>
              {next && (
                <p className="text-sm text-muted">
                  Next: {WEEKDAYS[next.weekday]} {humanizeGap(next.minutesAway)}
                </p>
              )}
            </div>
            <div className="mt-3">
              <HoursTable
                hours={faculty.officeHours}
                highlightWeekday={clock.weekday}
                currentWindow={availability.currentWindow}
              />
            </div>
            {availability.currentWindow && (
              <p className="mt-4 rounded-lg bg-soon-soft px-4 py-2.5 text-sm font-medium text-soon">
                Office hours are running now:{" "}
                {formatRange(
                  availability.currentWindow.start_minute,
                  availability.currentWindow.end_minute,
                )}
                .
              </p>
            )}
            <p className="mt-4 text-xs text-muted">
              Last updated {formatUpdated(faculty.updated_at)}.
            </p>
          </section>
        </div>

        {/* ── Directions ─────────────────────────────────────────────────── */}
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="directions-heading">
            <h2 id="directions-heading" className="text-lg font-semibold">
              How to get there
            </h2>
            <p className="mt-1 text-sm font-medium text-brand-ink">{faculty.officeLabel}</p>
            <div className="mt-4">
              <DirectionsPanel faculty={faculty} />
            </div>
          </section>

          <CampusMap buildings={listBuildings(db)} highlight={faculty.building_code} />

          <aside className="card bg-brand-soft/50 p-5 text-sm text-ink-soft">
            <h2 className="text-sm font-semibold text-brand-ink">Before you walk over</h2>
            <p className="mt-2">
              FIND shows what {firstName(faculty.full_name)} published — it does not detect whether
              they are physically in the room. An amber badge means their timetable says they should
              be in; only a green badge means they said so themselves.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] ?? fullName;
}

function formatUpdated(value: string): string {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-PH", {
    timeZone: process.env.FIND_TZ ?? "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
