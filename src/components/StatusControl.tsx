"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Availability } from "@/lib/availability";

/**
 * Where a faculty member posts their own availability, and sets an absence
 * override when they will be away for a day, a week or a month.
 *
 * Three deliberate choices, all from the "information system, not tracking
 * system" rule:
 *   - nothing is posted unless this form is submitted;
 *   - every override carries an end, so a status set before a conference is not
 *     still telling students something false three weeks later;
 *   - the form shows the exact sentence students will read before it is saved.
 */

const CHOICES = [
  {
    value: "available" as const,
    icon: "🟢",
    label: "Available",
    help: "I am in and free for consultation.",
  },
  {
    value: "office_hours" as const,
    icon: "🟡",
    label: "In office hours",
    help: "Holding office hours — students may drop by.",
  },
  {
    value: "unavailable" as const,
    icon: "🔴",
    label: "Away / Unavailable",
    help: "I am not in. Do not make the trip.",
  },
];

type Preset = {
  value: string;
  label: string;
  group: "now" | "away";
  /** Given "now", when does the override lapse? null = until cleared. */
  endsAt: (now: Date) => Date | null;
};

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 0, 0);
  return end;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return endOfDay(next);
}

const PRESETS: Preset[] = [
  { value: "1h", label: "1 hour", group: "now", endsAt: (n) => new Date(n.getTime() + 3_600_000) },
  { value: "2h", label: "2 hours", group: "now", endsAt: (n) => new Date(n.getTime() + 7_200_000) },
  { value: "4h", label: "4 hours", group: "now", endsAt: (n) => new Date(n.getTime() + 14_400_000) },
  { value: "today", label: "The rest of today", group: "now", endsAt: (n) => endOfDay(n) },
  { value: "1d", label: "1 day", group: "away", endsAt: (n) => addDays(n, 1) },
  { value: "3d", label: "3 days", group: "away", endsAt: (n) => addDays(n, 3) },
  { value: "1w", label: "1 week", group: "away", endsAt: (n) => addDays(n, 7) },
  { value: "2w", label: "2 weeks", group: "away", endsAt: (n) => addDays(n, 14) },
  {
    value: "1mo",
    label: "1 month",
    group: "away",
    endsAt: (n) => {
      const end = new Date(n);
      end.setMonth(end.getMonth() + 1);
      return endOfDay(end);
    },
  },
  { value: "date", label: "Until a date I pick…", group: "away", endsAt: () => null },
  { value: "open", label: "Until I clear it", group: "away", endsAt: () => null },
];

function formatEnd(date: Date | null, withTime: boolean): string {
  if (!date) return "until you clear it";
  return `until ${date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  })}`;
}

export default function StatusControl({
  facultyId,
  availability,
  initialNote,
}: {
  facultyId: number;
  availability: Availability;
  initialNote: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(
    availability.selfReported ? availability.state : null,
  );
  const [note, setNote] = useState(initialNote);
  const [preset, setPreset] = useState("4h");
  const [customDate, setCustomDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = PRESETS.find((p) => p.value === preset) ?? PRESETS[2];

  const endsAt = useMemo(() => {
    if (preset === "open") return null;
    if (preset === "date") return customDate ? endOfDay(new Date(`${customDate}T12:00`)) : null;
    return selected.endsAt(new Date());
  }, [preset, customDate, selected]);

  const longAbsence = Boolean(endsAt && endsAt.getTime() - Date.now() > 24 * 3_600_000);
  const previewLabel =
    choice === "unavailable" ? (longAbsence ? "Away" : "Unavailable") : choice === "available" ? "Available" : "In office hours";

  async function post(status: string | null) {
    if (status && preset === "date" && !customDate) {
      setError("Pick the date you will be back.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/faculty/${facultyId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manual_status: status,
        manual_note: status ? note.trim() : "",
        expires_at: status && endsAt ? endsAt.toISOString() : null,
        expires_in_minutes: null,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.issues?.[0]?.message ?? payload.error ?? "Could not save your status.");
    } else {
      setChoice(status);
      setMessage(
        status
          ? "Posted. Students see this on your profile now."
          : "Cleared. Your badge follows your published office hours again.",
      );
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      <fieldset disabled={busy}>
        <legend className="label">What should students see?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHOICES.map((option) => {
            const active = choice === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setChoice(option.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-raise"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden="true">{option.icon}</span>
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-muted">{option.help}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_15rem]">
          <div>
            <label htmlFor="status-note" className="label">
              Note for students (optional)
            </label>
            <input
              id="status-note"
              type="text"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Attending a seminar — email me instead."
              className="field"
            />
          </div>

          <div>
            <label htmlFor="status-duration" className="label">
              How long
            </label>
            <select
              id="status-duration"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="field"
            >
              <optgroup label="Just for now">
                {PRESETS.filter((p) => p.group === "now").map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Away for longer">
                {PRESETS.filter((p) => p.group === "away").map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {preset === "date" && (
          <div className="mt-3 max-w-xs">
            <label htmlFor="status-date" className="label">
              Back on
            </label>
            <input
              id="status-date"
              type="date"
              value={customDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomDate(e.target.value)}
              className="field"
            />
          </div>
        )}
      </fieldset>

      {/* The exact sentence a student will read, before it is saved. */}
      <p className="mt-4 rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
        <span className="font-semibold text-ink">Students will see: </span>
        {choice ? (
          <>
            <span className="font-semibold text-brand-ink">{previewLabel}</span>
            {preset !== "open" && <> — {formatEnd(endsAt, !longAbsence)}</>}
            {preset === "open" && <> — until you clear it</>}
            {note.trim() && <> · {note.trim()}</>}
          </>
        ) : (
          <span className="text-muted">
            your published office hours, with nothing posted on top of them.
          </span>
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => post(choice)}
          disabled={busy || !choice}
          className="btn btn-primary"
        >
          {busy ? "Saving…" : "Post this status"}
        </button>
        <button
          type="button"
          onClick={() => post(null)}
          disabled={busy || !availability.selfReported}
          className="btn btn-quiet"
        >
          Clear my status
        </button>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm">
        {error && <span className="font-medium text-shut">{error}</span>}
        {message && !error && <span className="font-medium text-open">{message}</span>}
        {!error && !message && !availability.selfReported && (
          <span className="text-muted">
            Nothing posted — students see your published office hours.
          </span>
        )}
        {!error && !message && availability.selfReported && availability.until && (
          <span className="text-muted">
            Posted now, lapsing on its own {formatEnd(new Date(availability.until), !availability.longAbsence)}.
          </span>
        )}
      </p>
    </div>
  );
}
