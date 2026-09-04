"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Availability } from "@/lib/availability";

/**
 * Where a faculty member posts their own availability.
 *
 * Two deliberate choices, both from the "information system, not tracking
 * system" rule:
 *   - nothing is posted unless this form is submitted;
 *   - a posted status carries an expiry, so a status forgotten on a Friday does
 *     not still be telling students something false on Monday.
 */

const CHOICES = [
  {
    value: "available" as const,
    icon: "🟢",
    label: "Available",
    help: "I am in and free for consultation now.",
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
    label: "Unavailable",
    help: "I am away. Do not make the trip.",
  },
];

const DURATIONS = [
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "the rest of the day" },
  { value: "1440", label: "24 hours" },
  { value: "", label: "until I clear it" },
];

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
  const [duration, setDuration] = useState("240");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(status: string | null) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/faculty/${facultyId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manual_status: status,
        manual_note: status ? note.trim() : "",
        expires_in_minutes: status && duration ? Number(duration) : null,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? "Could not save your status.");
    } else {
      setChoice(status);
      setMessage(
        status
          ? "Posted. Students will see this on your profile."
          : "Cleared. Your badge now follows your published office hours.",
      );
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      <fieldset disabled={busy}>
        <legend className="label">What should students see right now?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHOICES.map((option) => {
            const active = choice === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => post(option.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface hover:bg-raise"
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

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
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
              placeholder="e.g. In my office grading — drop by anytime."
              className="field"
            />
          </div>
          <div>
            <label htmlFor="status-duration" className="label">
              Keep this for
            </label>
            <select
              id="status-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="field sm:w-52"
            >
              {DURATIONS.map((d) => (
                <option key={d.label} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => post(choice)}
          disabled={busy || !choice}
          className="btn btn-primary"
        >
          {busy ? "Saving…" : "Update note & duration"}
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
            Nothing posted — students see your published office hours instead.
          </span>
        )}
      </p>
    </div>
  );
}
