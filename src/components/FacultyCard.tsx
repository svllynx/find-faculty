import Link from "next/link";
import type { FacultyRecord } from "@/lib/faculty";
import { WEEKDAYS, formatRange } from "@/lib/time";
import StatusBadge from "./StatusBadge";
import Avatar from "./Avatar";

/**
 * One search result: who they are, where their office is, and the single most
 * useful time fact — either the block running now, or the next one.
 */
export default function FacultyCard({ faculty }: { faculty: FacultyRecord }) {
  const { availability } = faculty;
  const next = availability.nextWindow;

  const timeLine = availability.currentWindow
    ? `Office hours now, until ${formatRange(
        availability.currentWindow.start_minute,
        availability.currentWindow.end_minute,
      ).split(" – ")[1]}`
    : next
      ? `Next: ${WEEKDAYS[next.weekday]}, ${formatRange(next.start_minute, next.end_minute)}`
      : "No office hours published";

  return (
    <li className="card p-4 transition-shadow hover:shadow-sm focus-within:shadow-sm">
      <article>
        <div className="flex items-start gap-3">
          <Avatar name={faculty.full_name} photo={faculty.photo_url} />

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight">
              <Link href={`/faculty/${faculty.id}`} className="text-ink hover:text-brand">
                {faculty.full_name}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted">
              {faculty.title}
              {faculty.title && faculty.department_name ? " · " : ""}
              {faculty.department_name}
            </p>
          </div>

          <StatusBadge availability={availability} size="sm" />
        </div>

        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="sr-only">Office</dt>
            <dd className="flex gap-2 text-ink-soft">
              <span aria-hidden="true" className="text-muted">
                📍
              </span>
              <span>{faculty.officeLabel}</span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">Office hours</dt>
            <dd className="flex gap-2 text-ink-soft">
              <span aria-hidden="true" className="text-muted">
                🕐
              </span>
              <span>{timeLine}</span>
            </dd>
          </div>
          {faculty.subjectList.length > 0 && (
            <div className="flex gap-2">
              <dt className="sr-only">Subjects</dt>
              <dd className="flex gap-2 text-muted">
                <span aria-hidden="true">📘</span>
                <span className="truncate">{faculty.subjectList.join(" · ")}</span>
              </dd>
            </div>
          )}
        </dl>

        <Link
          href={`/faculty/${faculty.id}`}
          className="group mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-ink"
        >
          Office &amp; directions
          <span aria-hidden="true" className="btn-icon h-6 w-6 text-xs">
            →
          </span>
        </Link>
      </article>
    </li>
  );
}
