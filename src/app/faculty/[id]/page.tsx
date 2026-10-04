import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarX } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/lib/db";
import { getFaculty, listRooms } from "@/lib/faculty";
import { SCHEDULE_TYPE_LABEL } from "@/lib/availability";
import { upcomingDatesFor } from "@/lib/appointments";
import { campusNow, humanizeGap, formatRange, formatDate, WEEKDAYS } from "@/lib/time";
import { currentUser, canEditFaculty } from "@/lib/auth";
import StatusBadge, { SourceNote } from "@/components/StatusBadge";
import HoursTable from "@/components/HoursTable";
import DirectionsPanel from "@/components/DirectionsPanel";
import FloorMap from "@/components/FloorMap";
import Avatar from "@/components/Avatar";
import AppointmentRequestForm from "@/components/AppointmentRequestForm";

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
  const floor = faculty.room_floor ?? 1;
  const rooms = listRooms(db, floor);

  const upcomingDates = Object.fromEntries(
    [...new Set(faculty.officeHours.map((h) => h.weekday))].map((weekday) => [
      weekday,
      upcomingDatesFor(weekday, 1, now)[0],
    ]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <Link href="/search" className="text-muted hover:text-brand">
          Faculty search
        </Link>
        <span aria-hidden="true" className="mx-2 text-line">
          /
        </span>
        <span className="text-ink-soft">{faculty.full_name}</span>
      </nav>

      {/* ── Identity + status ─────────────────────────────────────────────── */}
      <header data-hero-reveal className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={faculty.full_name} photo={faculty.photo_url} size="lg" />
            <div>
              <h1 className="text-2xl tracking-tight sm:text-3xl">{faculty.full_name}</h1>
              <p className="mt-1 text-[15px] text-ink-soft">
                {faculty.title}
                {faculty.title && faculty.department_name ? " · " : ""}
                {faculty.department_name}
              </p>
              {faculty.college_code && (
                <p className="mt-0.5 text-sm text-muted">
                  {faculty.college_name} ({faculty.college_code})
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <StatusBadge availability={availability} />
            <SourceNote availability={availability} />
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-canvas px-4 py-3 text-sm text-ink-soft">
          {availability.detail}
        </p>

        {/* A long absence is the one thing worth repeating loudly: it is the
            difference between "come back later" and "come back next month". */}
        {availability.longAbsence && availability.until && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-shut/25 bg-shut-soft px-4 py-3 text-sm text-shut">
            <CalendarX aria-hidden="true" weight="light" className="shrink-0" size={18} />
            <span>
              <strong className="font-semibold">Away until {formatDate(availability.until)}.</strong>{" "}
              Office hours below resume after that date.
            </span>
          </p>
        )}

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
              className="group inline-flex items-center gap-2 font-semibold text-brand hover:text-brand-ink"
            >
              Update this record
              <span aria-hidden="true" className="btn-icon h-6 w-6 text-xs">
                →
              </span>
            </Link>
          </p>
        )}
      </header>

      {/* grid-cols-1 + min-w-0 on each column: a CSS grid item defaults to
          min-width:auto just like a flex item, so without this an unbroken
          long string anywhere inside either column can force that column —
          and the whole grid — wider than the viewport. */}
      <div data-reveal-group className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Office + hours ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <section data-reveal className="card p-5 sm:p-6" aria-labelledby="office-heading">
            <h2 id="office-heading" className="text-lg font-semibold">
              Office
            </h2>
            <dl className="mt-3 divide-y divide-line text-sm">
              <Row label="Building">{faculty.building_name ?? "Not assigned"}</Row>
              <Row label="Room">
                {faculty.room_number ? (
                  <>
                    Room {faculty.room_number}
                    {faculty.room_name ? ` — ${faculty.room_name}` : ""}
                  </>
                ) : (
                  "Not assigned"
                )}
              </Row>
              {faculty.floorLabel && <Row label="Floor">{faculty.floorLabel}</Row>}
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

          <section data-reveal className="card p-5 sm:p-6" aria-labelledby="hours-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="hours-heading" className="text-lg font-semibold">
                Weekly schedule
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
                {SCHEDULE_TYPE_LABEL[availability.currentWindow.type ?? "office"]} running now:{" "}
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

          <section data-reveal className="card p-5 sm:p-6" aria-labelledby="appointment-heading">
            <h2 id="appointment-heading" className="text-lg font-semibold">
              Request an appointment
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pick one of {firstName(faculty.full_name)}&rsquo;s published blocks. They approve or
              decline it from their dashboard — nothing is booked until they do.
            </p>
            <div className="mt-4">
              <AppointmentRequestForm
                facultyId={faculty.id}
                firstName={firstName(faculty.full_name)}
                officeHours={faculty.officeHours}
                upcomingDates={upcomingDates}
              />
            </div>
          </section>
        </div>

        {/* ── Directions ─────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <section data-reveal className="card p-5 sm:p-6" aria-labelledby="directions-heading">
            <h2 id="directions-heading" className="text-lg font-semibold">
              How to get there
            </h2>
            <p className="mt-1 text-sm font-medium text-brand-ink">{faculty.officeLabel}</p>
            <div className="mt-4">
              <DirectionsPanel faculty={faculty} />
            </div>
          </section>

          {faculty.room_id && (
            <div data-reveal>
              <FloorMap
                rooms={rooms}
                floor={floor}
                buildingName={faculty.building_name ?? "CCIS Building"}
                highlightRoomId={faculty.room_id}
              />
            </div>
          )}

          <aside data-reveal className="card bg-brand-soft/50 p-5 text-sm text-ink-soft">
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
      {/* min-w-0 is load-bearing: without it a flex item refuses to shrink below
          its content's natural width, so one long unbroken token (an email, a
          long subject list) pushes this row — and everything above it — wider
          than the viewport instead of wrapping. */}
      <dd className="min-w-0 flex-1 break-words text-ink">{children}</dd>
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
