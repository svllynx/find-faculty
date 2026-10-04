"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppointmentRecord } from "@/lib/appointments";
import { SCHEDULE_TYPE_LABEL } from "@/lib/availability";
import { WEEKDAYS, formatRange, formatDate } from "@/lib/time";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-soon-soft text-soon",
  approved: "bg-open-soft text-open",
  declined: "bg-shut-soft text-shut",
  cancelled: "bg-raise text-muted",
};

/** Faculty (and admin, acting for them) approve or decline a student's request. */
export default function AppointmentsPanel({
  appointments,
}: {
  appointments: AppointmentRecord[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(id: number, status: "approved" | "declined") {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/appointments/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Could not update that request.");
      setBusyId(null);
      return;
    }
    router.refresh();
    setBusyId(null);
  }

  if (appointments.length === 0) {
    return <p className="text-sm text-muted">No appointment requests yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm font-medium text-shut">{error}</p>}
      <ul className="space-y-2">
        {appointments.map((a) => (
          <li key={a.id} className="rounded-lg border border-line bg-canvas p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{a.student_name}</p>
                <p className="text-sm text-muted">{a.student_email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                  STATUS_TONE[a.status] ?? "bg-raise text-muted"
                }`}
              >
                {a.status}
              </span>
            </div>

            <p className="mt-2 text-sm text-ink-soft">
              {formatDate(new Date(`${a.requested_date}T12:00:00`))} · {WEEKDAYS[a.weekday]}{" "}
              {formatRange(a.start_minute, a.end_minute)} ·{" "}
              {SCHEDULE_TYPE_LABEL[a.schedule_type]}
            </p>
            {a.reason && <p className="mt-1 text-sm text-ink-soft">&ldquo;{a.reason}&rdquo;</p>}

            {a.status === "pending" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => respond(a.id, "approved")}
                  className="btn btn-primary h-9 px-3 text-sm"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => respond(a.id, "declined")}
                  className="btn btn-quiet h-9 px-3 text-sm text-shut"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
