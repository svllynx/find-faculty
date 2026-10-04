"use client";

import { useMemo, useState } from "react";
import type { OfficeHour, ScheduleType } from "@/lib/availability";
import { SCHEDULE_TYPE_LABEL } from "@/lib/availability";
import { WEEKDAYS, formatRange, formatDate } from "@/lib/time";

/**
 * A student requesting a specific meeting against one of a faculty member's
 * published blocks. No account needed — a name and email travel with the
 * request instead, and the faculty member approves or declines it from their
 * dashboard. The block itself already says what kind of time it is (office /
 * consultation / class hours), so the request just inherits that label.
 */

type Slot = {
  key: string;
  hour: OfficeHour;
  date: string; // the soonest upcoming occurrence, 'YYYY-MM-DD'
};

export default function AppointmentRequestForm({
  facultyId,
  firstName,
  officeHours,
  upcomingDates,
}: {
  facultyId: number;
  firstName: string;
  officeHours: OfficeHour[];
  /** weekday -> soonest matching date, precomputed on the server (campus time). */
  upcomingDates: Record<number, string>;
}) {
  const slots: Slot[] = useMemo(
    () =>
      officeHours.map((hour, index) => ({
        key: `${hour.weekday}-${hour.start_minute}-${index}`,
        hour,
        date: upcomingDates[hour.weekday] ?? "",
      })),
    [officeHours, upcomingDates],
  );

  const [open, setOpen] = useState(false);
  const [slotKey, setSlotKey] = useState(slots[0]?.key ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selected = slots.find((s) => s.key === slotKey) ?? slots[0] ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/faculty/${facultyId}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        office_hour_id: null,
        student_name: name.trim(),
        student_email: email.trim(),
        reason: reason.trim(),
        requested_date: selected.date,
        weekday: selected.hour.weekday,
        start_minute: selected.hour.start_minute,
        end_minute: selected.hour.end_minute,
        type: selected.hour.type ?? "office",
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.issues?.[0]?.message ?? payload.error ?? "Could not send that request.");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted">
        {firstName} has not published any hours yet, so there is nothing to request an
        appointment against.
      </p>
    );
  }

  if (done) {
    return (
      <p className="rounded-lg border border-open/25 bg-open-soft px-4 py-3 text-sm font-medium text-open">
        Sent. {firstName} will approve or decline it — you will not hear back here, so use the
        email address you entered.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-quiet">
        Request an appointment
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-canvas p-4">
      <div>
        <label htmlFor="appt-slot" className="label">
          Pick a time
        </label>
        <select
          id="appt-slot"
          value={slotKey}
          onChange={(e) => setSlotKey(e.target.value)}
          className="field"
        >
          {slots.map((slot) => {
            const type = (slot.hour.type ?? "office") as ScheduleType;
            return (
              <option key={slot.key} value={slot.key}>
                {formatDate(new Date(`${slot.date}T12:00:00`))} · {WEEKDAYS[slot.hour.weekday]}{" "}
                {formatRange(slot.hour.start_minute, slot.hour.end_minute)} ·{" "}
                {SCHEDULE_TYPE_LABEL[type]}
              </option>
            );
          })}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="appt-name" className="label">
            Your name
          </label>
          <input
            id="appt-name"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="appt-email" className="label">
            Your email
          </label>
          <input
            id="appt-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="appt-reason" className="label">
          What is it about? (optional)
        </label>
        <input
          id="appt-reason"
          type="text"
          maxLength={400}
          placeholder="e.g. Thesis proposal feedback"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="field"
        />
      </div>

      {error && <p className="text-sm font-medium text-shut">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !selected} className="btn btn-primary">
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
          Cancel
        </button>
      </div>
    </form>
  );
}
