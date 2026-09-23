"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Department, FacultyRecord, RoomWithOccupants } from "@/lib/faculty";

/**
 * Office and contact details.
 *
 * The office is picked from the rooms that exist on the floor plan rather than
 * typed, so the directory can never point at a room the map does not have. The
 * name field is admin-only: a rename changes how every student searches for
 * this person.
 */
export default function ProfileForm({
  faculty,
  departments,
  rooms,
  canRename,
}: {
  faculty: FacultyRecord;
  departments: Department[];
  rooms: RoomWithOccupants[];
  canRename: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: faculty.full_name,
    title: faculty.title,
    department_id: faculty.department_id ? String(faculty.department_id) : "",
    room_id: faculty.room_id ? String(faculty.room_id) : "",
    email: faculty.email,
    phone: faculty.phone,
    subjects: faculty.subjects,
    consultation_note: faculty.consultation_note,
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value }));

  const byFloor = new Map<number, RoomWithOccupants[]>();
  for (const room of rooms) {
    const list = byFloor.get(room.floor) ?? [];
    list.push(room);
    byFloor.set(room.floor, list);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const body: Record<string, unknown> = {
      title: form.title,
      email: form.email,
      phone: form.phone,
      subjects: form.subjects,
      consultation_note: form.consultation_note,
      department_id: form.department_id ? Number(form.department_id) : null,
      room_id: form.room_id ? Number(form.room_id) : null,
    };
    if (canRename) body.full_name = form.full_name;

    const response = await fetch(`/api/faculty/${faculty.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const issue = payload.issues?.[0];
      setError(issue ? `${issue.path}: ${issue.message}` : (payload.error ?? "Could not save."));
    } else {
      setMessage("Saved. Students see the updated details immediately.");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className="label">
            Full name
          </label>
          <input
            id="full_name"
            value={form.full_name}
            onChange={set("full_name")}
            disabled={!canRename}
            className="field disabled:bg-raise disabled:text-muted"
          />
          {!canRename && (
            <p className="mt-1 text-xs text-muted">
              Ask your department admin to change the name on a record.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="title" className="label">
            Academic title
          </label>
          <input id="title" value={form.title} onChange={set("title")} className="field" />
        </div>

        <div>
          <label htmlFor="department_id" className="label">
            Department
          </label>
          <select
            id="department_id"
            value={form.department_id}
            onChange={set("department_id")}
            className="field"
          >
            <option value="">Not assigned</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="room_id" className="label">
            Office room
          </label>
          <select id="room_id" value={form.room_id} onChange={set("room_id")} className="field">
            <option value="">Not assigned</option>
            {[...byFloor.keys()]
              .sort((a, b) => a - b)
              .map((floor) => (
                <optgroup key={floor} label={`${floor === 1 ? "1st" : `${floor}th`} floor`}>
                  {(byFloor.get(floor) ?? []).map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.number}
                      {room.name ? ` — ${room.name}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            This is what the floor plan points students to.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" value={form.email} onChange={set("email")} className="field" />
        </div>

        <div>
          <label htmlFor="phone" className="label">
            Local / extension
          </label>
          <input id="phone" value={form.phone} onChange={set("phone")} className="field" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="subjects" className="label">
            Subjects taught (comma separated — students search by these)
          </label>
          <input
            id="subjects"
            value={form.subjects}
            onChange={set("subjects")}
            className="field"
            placeholder="Data Structures, Algorithms, CS Thesis 1"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="consultation_note" className="label">
            Note shown on your profile
          </label>
          <textarea
            id="consultation_note"
            value={form.consultation_note}
            onChange={set("consultation_note")}
            rows={2}
            maxLength={400}
            className="field"
            placeholder="e.g. Email me a short agenda before dropping by."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : "Save details"}
        </button>
        <span aria-live="polite" className="text-sm">
          {error && <span className="font-medium text-shut">{error}</span>}
          {message && !error && <span className="font-medium text-open">{message}</span>}
        </span>
      </div>
    </form>
  );
}
