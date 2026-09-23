import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getFaculty, listDepartments, listRooms } from "@/lib/faculty";
import { currentUser } from "@/lib/auth";
import { campusNow, WEEKDAYS, formatMinute, formatDate } from "@/lib/time";
import StatusBadge from "@/components/StatusBadge";
import StatusControl from "@/components/StatusControl";
import HoursEditor from "@/components/HoursEditor";
import ProfileForm from "@/components/ProfileForm";
import PhotoUpload from "@/components/PhotoUpload";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My office hours" };

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");

  const db = getDb();

  if (user.faculty_id === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">Your account is not linked to a faculty record yet</h1>
        <p className="mt-3 text-sm text-ink-soft">
          A department admin needs to link {user.email} to your directory entry before you can
          publish office hours. Until then students will not see a profile for you.
        </p>
      </div>
    );
  }

  const now = new Date();
  const faculty = getFaculty(db, user.faculty_id, now);
  if (!faculty) redirect("/login");

  const clock = campusNow(now);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={faculty.full_name} photo={faculty.photo_url} size="md" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{faculty.full_name}</h1>
            <p className="mt-1 text-sm text-muted">
              {faculty.officeLabel} · {WEEKDAYS[clock.weekday]}, {formatMinute(clock.minute)} on
              campus
            </p>
            {faculty.availability.longAbsence && faculty.availability.until && (
              <p className="mt-1 text-sm font-semibold text-shut">
                You are posted as away until {formatDate(faculty.availability.until)}.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <StatusBadge availability={faculty.availability} />
          <Link
            href={`/faculty/${faculty.id}`}
            className="text-sm font-semibold text-brand hover:text-brand-ink"
          >
            View as a student sees it
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </header>

      <section className="card mt-6 p-5 sm:p-6" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-lg font-semibold">
          Post your availability
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          This is the only thing that overrides your schedule, and it is entirely up to you. Use the
          longer options when you are away for a day, a week or a month — students then see the date
          you are back instead of a schedule you cannot keep. Leave it clear and they simply see
          your published office hours.
        </p>
        <div className="mt-4">
          <StatusControl
            facultyId={faculty.id}
            availability={faculty.availability}
            initialNote={faculty.manual_note ?? ""}
          />
        </div>
      </section>

      <section className="card mt-6 p-5 sm:p-6" aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="text-lg font-semibold">
          Weekly office hours
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The schedule students see, and what FIND uses to work out whether you are in office hours
          right now.
        </p>
        <div className="mt-4">
          <HoursEditor facultyId={faculty.id} hours={faculty.officeHours} />
        </div>
      </section>

      <section className="card mt-6 p-5 sm:p-6" aria-labelledby="photo-heading">
        <h2 id="photo-heading" className="text-lg font-semibold">
          Profile photo
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Optional, and yours to add or remove whenever you like. A photo helps a student walking
          into a shared faculty room know which desk to approach.
        </p>
        <div className="mt-4">
          <PhotoUpload
            facultyId={faculty.id}
            name={faculty.full_name}
            photo={faculty.photo_url || null}
          />
        </div>
      </section>

      <section className="card mt-6 p-5 sm:p-6" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-lg font-semibold">
          Office &amp; contact details
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Your room is what the floor plan points students to, so keeping it right is what makes
          the directions work.
        </p>
        <div className="mt-4">
          <ProfileForm
            faculty={faculty}
            departments={listDepartments(db)}
            rooms={listRooms(db)}
            canRename={false}
          />
        </div>
      </section>
    </div>
  );
}
