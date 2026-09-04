"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OfficeHour } from "@/lib/availability";
import { SHORT_WEEKDAYS, WEEKDAYS, parseTimeInput, toTimeInput } from "@/lib/time";

/**
 * The weekly office-hours editor.
 *
 * Sends the whole schedule on save (PUT), so what the faculty member sees on
 * screen is exactly what students get — no drift between rows added here and
 * rows deleted elsewhere.
 */

type Draft = {
  key: string;
  weekday: number;
  start: string;
  end: string;
  note: string;
};

let counter = 0;
const nextKey = () => `row-${(counter += 1)}`;

function toDraft(hour: OfficeHour): Draft {
  return {
    key: nextKey(),
    weekday: hour.weekday,
    start: toTimeInput(hour.start_minute),
    end: toTimeInput(hour.end_minute),
    note: hour.location_note ?? "",
  };
}

export default function HoursEditor({
  facultyId,
  hours,
}: {
  facultyId: number;
  hours: OfficeHour[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(hours.map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: string, patch: Partial<Draft>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addRow = () =>
    setRows((current) => [
      ...current,
      { key: nextKey(), weekday: 1, start: "13:00", end: "15:00", note: "" },
    ]);

  const removeRow = (key: string) =>
    setRows((current) => current.filter((row) => row.key !== key));

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);

    const payload: OfficeHour[] = [];
    for (const row of rows) {
      const start = parseTimeInput(row.start);
      const end = parseTimeInput(row.end);
      if (start === null || end === null) {
        setError(`Enter a valid start and end time for ${WEEKDAYS[row.weekday]}.`);
        setBusy(false);
        return;
      }
      if (end <= start) {
        setError(`${WEEKDAYS[row.weekday]}: the end time must be after the start time.`);
        setBusy(false);
        return;
      }
      payload.push({
        weekday: row.weekday,
        start_minute: start,
        end_minute: end,
        location_note: row.note.trim(),
      });
    }

    const response = await fetch(`/api/faculty/${facultyId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const issue = body.issues?.[0]?.message;
      setError(issue ?? body.error ?? "Could not save your office hours.");
    } else {
      setMessage(
        payload.length === 0
          ? "Saved. Your profile now shows no published office hours."
          : `Saved ${payload.length} office-hour ${payload.length === 1 ? "block" : "blocks"}.`,
      );
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-canvas px-4 py-5 text-sm text-muted">
          No office-hour blocks yet. Add one so students know when to come by.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className="grid gap-2 rounded-lg border border-line bg-canvas p-3 sm:grid-cols-[7rem_1fr_1fr_1.4fr_auto] sm:items-end"
            >
              <div>
                <label htmlFor={`day-${row.key}`} className="label">
                  Day
                </label>
                <select
                  id={`day-${row.key}`}
                  value={row.weekday}
                  onChange={(e) => update(row.key, { weekday: Number(e.target.value) })}
                  className="field"
                >
                  {SHORT_WEEKDAYS.map((label, index) => (
                    <option key={index} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`start-${row.key}`} className="label">
                  From
                </label>
                <input
                  id={`start-${row.key}`}
                  type="time"
                  value={row.start}
                  onChange={(e) => update(row.key, { start: e.target.value })}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor={`end-${row.key}`} className="label">
                  To
                </label>
                <input
                  id={`end-${row.key}`}
                  type="time"
                  value={row.end}
                  onChange={(e) => update(row.key, { end: e.target.value })}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor={`note-${row.key}`} className="label">
                  Where (if not your office)
                </label>
                <input
                  id={`note-${row.key}`}
                  type="text"
                  value={row.note}
                  maxLength={120}
                  placeholder="e.g. Dept. office"
                  onChange={(e) => update(row.key, { note: e.target.value })}
                  className="field"
                />
              </div>

              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="btn btn-quiet h-[38px] px-3 text-shut"
                aria-label={`Remove the ${WEEKDAYS[row.weekday]} block starting ${row.start}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} className="btn btn-quiet">
          + Add a block
        </button>
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : "Save office hours"}
        </button>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm">
        {error && <span className="font-medium text-shut">{error}</span>}
        {message && !error && <span className="font-medium text-open">{message}</span>}
      </p>
    </div>
  );
}
