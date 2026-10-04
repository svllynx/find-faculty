import Link from "next/link";
import { MapPin, Clock, BookOpen } from "@phosphor-icons/react/dist/ssr";
import type { FacultyRecord } from "@/lib/faculty";
import { WEEKDAYS, formatRange } from "@/lib/time";
import { SCHEDULE_TYPE_LABEL } from "@/lib/availability";
import StatusBadge from "./StatusBadge";
import Avatar from "./Avatar";

/**
 * One search result: who they are, where their office is, and the single most
 * useful time fact — either the block running now, or the next one.
 */
export default function FacultyCard({
  faculty,
  reveal = false,
}: {
  faculty: FacultyRecord;
  /** Opt into the GSAP scroll-reveal (see ScrollReveal); off by default so
      single-card contexts, like the room directory on /map, stay static. */
  reveal?: boolean;
}) {
  const { availability } = faculty;
  const next = availability.nextWindow;

  const timeLine = availability.currentWindow
    ? `${SCHEDULE_TYPE_LABEL[availability.currentWindow.type ?? "office"]} now, until ${formatRange(
        availability.currentWindow.start_minute,
        availability.currentWindow.end_minute,
      ).split(" – ")[1]}`
    : next
      ? `Next: ${WEEKDAYS[next.weekday]}, ${formatRange(next.start_minute, next.end_minute)}${
          next.type ? ` (${SCHEDULE_TYPE_LABEL[next.type].toLowerCase()})` : ""
        }`
      : "No hours published";

  return (
    <li {...(reveal ? { "data-reveal": true } : {})} className="card hover-lift p-4">
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
            <dd className="flex items-center gap-2 text-ink-soft">
              <MapPin aria-hidden="true" weight="light" className="shrink-0 text-muted" size={16} />
              <span>{faculty.officeLabel}</span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">Office hours</dt>
            <dd className="flex items-center gap-2 text-ink-soft">
              <Clock aria-hidden="true" weight="light" className="shrink-0 text-muted" size={16} />
              <span>{timeLine}</span>
            </dd>
          </div>
          {faculty.subjectList.length > 0 && (
            <div className="flex gap-2">
              <dt className="sr-only">Subjects</dt>
              <dd className="flex items-center gap-2 text-muted">
                <BookOpen aria-hidden="true" weight="light" className="shrink-0" size={16} />
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
