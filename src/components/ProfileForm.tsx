"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Building, Department, FacultyRecord } from "@/lib/faculty";

/**
 * Office location and contact details. The name field is admin-only, because a
 * rename affects how every student searches for this person.
 */
export default function ProfileForm({
  faculty,
  departments,
  buildings,
  canRename,
}: {
  faculty: FacultyRecord;
  departments: Department[];
  buildings: Building[];
  canRename: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: faculty.full_name,
    title: faculty.title,
    department_id: faculty.department_id ? String(faculty.department_id) : "",
    building_id: faculty.building_id ? String(faculty.building_id) : "",
    room: faculty.room,
    floor: faculty.floor,
    email: faculty.email,
    phone: faculty.phone,
    subjects: faculty.subjects,
    consultation_note: faculty.consultation_note,
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const body: Record<string, unknown> = {
      title: form.title,
      room: form.room,
      floor: form.floor,
      email: form.email,
      phone: form.phone,
      subjects: form.subjects,
      consultation_note: form.consultation_note,
      department_id: form.department_id ? Number(form.department_id) : null,
      building_id: form.building_id ? Number(form.building_id) : null,
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
      setError(issue ? `${issue.path}: ${issue.message}` : payload.error ?? "Could not save.");
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
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="building_id" className="label">
            Building
          </label>
          <select
            id="building_id"
            value={form.building_id}
            onChange={set("building_id")}
            className="field"
          >
            <option value="">Not assigned</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="room" className="label">
            Room
          </label>
          <input id="room" value={form.room} onChange={set("room")} className="field" placeholder="204" />
        </div>

        <div>
          <label htmlFor="floor" className="label">
            Floor
          </label>
          <input
            id="floor"
            value={form.floor}
            onChange={set("floor")}
            className="field"
            placeholder="2nd floor"
          />
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
