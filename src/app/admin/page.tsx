import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDb, rows } from "@/lib/db";
import { getFaculty, listBuildings, listDepartments, searchFaculty } from "@/lib/faculty";
import { currentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import StatusControl from "@/components/StatusControl";
import HoursEditor from "@/components/HoursEditor";
import ProfileForm from "@/components/ProfileForm";
import AddFacultyForm from "@/components/AddFacultyForm";
import ArchiveToggle from "@/components/ArchiveToggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Manage faculty records" };

type Search = { faculty?: string; q?: string };

type AuditEntry = {
  id: number;
  actor_email: string;
  action: string;
  detail: string;
  created_at: string;
  faculty_name: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  "faculty.create": "added a record",
  "faculty.update": "edited details",
  "faculty.archive": "archived a record",
  "faculty.restore": "restored a record",
  "hours.replace": "changed office hours",
  "status.set": "posted availability",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const db = getDb();
  const now = new Date();

  const records = searchFaculty(db, { q: params.q, includeInactive: true }, now);
  const selectedId = params.faculty ? Number(params.faculty) : null;
  const selected =
    selectedId !== null && Number.isInteger(selectedId) ? getFaculty(db, selectedId, now) : null;

  const departments = listDepartments(db);
  const buildings = listBuildings(db);

  const audit = rows<AuditEntry>(
    db
      .prepare(
        `SELECT a.id, a.actor_email, a.action, a.detail, a.created_at, f.full_name AS faculty_name
           FROM audit_log a LEFT JOIN faculty f ON f.id = a.faculty_id
          ORDER BY a.id DESC LIMIT 12`,
      )
      .all(),
  );

  const missingHours = records.filter((r) => r.is_active && r.officeHours.length === 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage faculty records</h1>
          <p className="mt-1 text-sm text-muted">
            {records.filter((r) => r.is_active).length} active ·{" "}
            {records.filter((r) => !r.is_active).length} archived · signed in as {user.email}
          </p>
        </div>
        <AddFacultyForm departments={departments} buildings={buildings} />
      </header>

      {missingHours.length > 0 && (
        <p className="mt-5 rounded-lg border border-soon/30 bg-soon-soft px-4 py-3 text-sm text-soon">
          <strong className="font-semibold">{missingHours.length}</strong>{" "}
          {missingHours.length === 1 ? "record has" : "records have"} no published office hours:{" "}
          {missingHours.slice(0, 4).map((r, index) => (
            <span key={r.id}>
              {index > 0 && ", "}
              <Link href={`/admin?faculty=${r.id}`} className="font-semibold underline">
                {r.full_name}
              </Link>
            </span>
          ))}
          {missingHours.length > 4 && ` and ${missingHours.length - 4} more`}.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
        {/* ── Record list ───────────────────────────────────────────────── */}
        <aside className="card p-4">
          <form action="/admin" method="get" role="search">
            <label htmlFor="admin-q" className="label">
              Find a record
            </label>
            <input
              id="admin-q"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Name, department, room"
              className="field"
            />
          </form>

          <ul className="mt-3 max-h-[32rem] divide-y divide-line overflow-y-auto">
            {records.map((record) => {
              const active = record.id === selected?.id;
              return (
                <li key={record.id}>
                  <Link
                    href={`/admin?faculty=${record.id}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                    className={`block px-2 py-2.5 text-sm hover:bg-raise ${
                      active ? "rounded-md bg-brand-soft" : ""
                    }`}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-ink">{record.full_name}</span>
                      {!record.is_active && (
                        <span className="shrink-0 rounded bg-raise px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                          Archived
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {record.department_code ?? "—"} · {record.officeLabel} ·{" "}
                      {record.officeHours.length} block
                      {record.officeHours.length === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              );
            })}
            {records.length === 0 && (
              <li className="px-2 py-4 text-sm text-muted">No records matched.</li>
            )}
          </ul>
        </aside>

        {/* ── Editor ────────────────────────────────────────────────────── */}
        <div>
          {!selected ? (
            <div className="card px-6 py-16 text-center">
              <p className="text-base font-semibold">Choose a record to edit</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Pick a faculty member from the list to update their office, their office hours, or
                the availability shown to students.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <header className="card flex flex-wrap items-start justify-between gap-4 p-5">
                <div>
                  <h2 className="text-xl font-bold">{selected.full_name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {selected.title || "No title"} · {selected.department_name ?? "No department"}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <StatusBadge availability={selected.availability} />
                  <Link
                    href={`/faculty/${selected.id}`}
                    className="text-sm font-semibold text-brand hover:text-brand-ink"
                  >
                    View public profile
                    <span aria-hidden="true"> →</span>
                  </Link>
                </div>
              </header>

              <section className="card p-5" aria-labelledby="admin-details">
                <h3 id="admin-details" className="text-base font-semibold">
                  Office &amp; contact details
                </h3>
                <div className="mt-4">
                  <ProfileForm
                    key={`profile-${selected.id}`}
                    faculty={selected}
                    departments={departments}
                    buildings={buildings}
                    canRename
                  />
                </div>
              </section>

              <section className="card p-5" aria-labelledby="admin-hours">
                <h3 id="admin-hours" className="text-base font-semibold">
                  Office hours
                </h3>
                <div className="mt-4">
                  <HoursEditor
                    key={`hours-${selected.id}`}
                    facultyId={selected.id}
                    hours={selected.officeHours}
                  />
                </div>
              </section>

              <section className="card p-5" aria-labelledby="admin-status">
                <h3 id="admin-status" className="text-base font-semibold">
                  Availability posted on their behalf
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Only post here when the faculty member has asked you to — FIND presents this as
                  something they said.
                </p>
                <div className="mt-4">
                  <StatusControl
                    key={`status-${selected.id}`}
                    facultyId={selected.id}
                    availability={selected.availability}
                    initialNote={selected.manual_note ?? ""}
                  />
                </div>
              </section>

              <section className="card p-5" aria-labelledby="admin-archive">
                <h3 id="admin-archive" className="text-base font-semibold">
                  Directory status
                </h3>
                <div className="mt-3">
                  <ArchiveToggle
                    key={`archive-${selected.id}`}
                    facultyId={selected.id}
                    name={selected.full_name}
                    active={selected.is_active}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ── Audit trail ─────────────────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="audit-heading">
        <h2 id="audit-heading" className="text-lg font-semibold">
          Recent changes
        </h2>
        <p className="mt-1 text-sm text-muted">
          Every edit is recorded, so a department can see whether its directory information is being
          kept current.
        </p>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm">
          {audit.map((entry) => (
            <li key={entry.id} className="flex flex-wrap gap-x-2 px-4 py-2.5">
              <span className="font-medium text-ink">{entry.actor_email}</span>
              <span className="text-muted">{ACTION_LABEL[entry.action] ?? entry.action}</span>
              {entry.faculty_name && <span className="text-ink-soft">for {entry.faculty_name}</span>}
              {entry.detail && <span className="text-muted">({entry.detail})</span>}
              <span className="ml-auto tabular-nums text-muted">{entry.created_at} UTC</span>
            </li>
          ))}
          {audit.length === 0 && <li className="px-4 py-4 text-muted">No changes recorded yet.</li>}
        </ul>
      </section>
    </div>
  );
}
