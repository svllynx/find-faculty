import type { OfficeHour } from "@/lib/availability";
import { WEEKDAYS, formatRange } from "@/lib/time";

/**
 * The weekly office-hours table. Days with nothing scheduled are omitted rather
 * than shown as empty rows, so a short schedule reads as short.
 */
export default function HoursTable({
  hours,
  highlightWeekday,
  currentWindow,
}: {
  hours: OfficeHour[];
  /** Today, so the student can find their row at a glance. */
  highlightWeekday?: number;
  /** The block that is open right now, if any. */
  currentWindow?: OfficeHour | null;
}) {
  if (hours.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-canvas px-4 py-6 text-sm text-muted">
        No office hours have been published for this faculty member yet. Their department office can
        tell you when to come by.
      </p>
    );
  }

  const byDay = new Map<number, OfficeHour[]>();
  for (const h of hours) {
    const list = byDay.get(h.weekday) ?? [];
    list.push(h);
    byDay.set(h.weekday, list);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  const isNow = (h: OfficeHour) =>
    currentWindow != null &&
    currentWindow.weekday === h.weekday &&
    currentWindow.start_minute === h.start_minute;

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Weekly office hours</caption>
      <thead>
        <tr className="border-b border-line text-left">
          <th scope="col" className="w-32 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Day
          </th>
          <th scope="col" className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Time
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => {
          const blocks = (byDay.get(day) ?? []).sort((a, b) => a.start_minute - b.start_minute);
          const today = day === highlightWeekday;
          return (
            <tr key={day} className="border-b border-line/70 align-top last:border-0">
              <th
                scope="row"
                className={`py-3 pr-3 text-left font-semibold ${today ? "text-brand" : "text-ink"}`}
              >
                {WEEKDAYS[day]}
                {today && (
                  <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
                    Today
                  </span>
                )}
              </th>
              <td className="py-3">
                <ul className="space-y-1.5">
                  {blocks.map((h) => (
                    <li key={`${h.start_minute}-${h.end_minute}`}>
                      <span
                        className={`font-medium tabular-nums ${
                          isNow(h) ? "text-soon" : "text-ink-soft"
                        }`}
                      >
                        {formatRange(h.start_minute, h.end_minute)}
                      </span>
                      {isNow(h) && (
                        <span className="ml-2 text-xs font-semibold text-soon">happening now</span>
                      )}
                      {h.location_note ? (
                        <span className="block text-xs text-muted">{h.location_note}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
