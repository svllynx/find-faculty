"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Building, Department } from "@/lib/faculty";

/** Department admins add a record here; office hours are filled in afterwards. */
export default function AddFacultyForm({
  departments,
  buildings,
}: {
  departments: Department[];
  buildings: Building[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    title: "",
    department_id: "",
    building_id: "",
    room: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/faculty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.full_name,
        title: form.title,
        room: form.room,
        department_id: form.department_id ? Number(form.department_id) : null,
        building_id: form.building_id ? Number(form.building_id) : null,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const issue = payload.issues?.[0];
      setError(issue ? `${issue.path}: ${issue.message}` : payload.error ?? "Could not add.");
      setBusy(false);
      return;
    }

    setForm({ full_name: "", title: "", department_id: "", building_id: "", room: "" });
    setBusy(false);
    setOpen(false);
    router.push(`/admin?faculty=${payload.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Add a faculty record
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full p-4">
      <h3 className="text-sm font-semibold">New faculty record</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="new_name" className="label">
            Full name
          </label>
          <input
            id="new_name"
            required
            value={form.full_name}
            onChange={set("full_name")}
            className="field"
            placeholder="Juan Santos"
          />
        </div>
        <div>
          <label htmlFor="new_title" className="label">
            Academic title
          </label>
          <input
            id="new_title"
            value={form.title}
            onChange={set("title")}
            className="field"
            placeholder="Associate Professor"
          />
        </div>
        <div>
          <label htmlFor="new_dept" className="label">
            Department
          </label>
          <select id="new_dept" value={form.department_id} onChange={set("department_id")} className="field">
            <option value="">Not assigned</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new_building" className="label">
            Building
          </label>
          <select id="new_building" value={form.building_id} onChange={set("building_id")} className="field">
            <option value="">Not assigned</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new_room" className="label">
            Room
          </label>
          <input id="new_room" value={form.room} onChange={set("room")} className="field" placeholder="204" />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-shut-soft px-3 py-2 text-sm font-medium text-shut">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Adding…" : "Add record"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
          Cancel
        </button>
      </div>
    </form>
  );
}
