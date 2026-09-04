"use client";

import { useRef } from "react";
import { SHORT_WEEKDAYS } from "@/lib/time";
import type { Building, Department } from "@/lib/faculty";

/**
 * The one search box.
 *
 * It is a plain GET form, so results are a shareable URL and the page still
 * works with JavaScript off. The client bit only auto-submits when a dropdown
 * changes, saving a click.
 */
export default function SearchForm({
  departments,
  buildings,
  initial,
}: {
  departments: Department[];
  buildings: Building[];
  initial: { q: string; department: string; building: string; day: string; openNow: boolean };
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();

  return (
    <form ref={form} action="/" method="get" role="search" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="q" className="sr-only">
            Search for a faculty member by name, department, subject or room
          </label>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          >
            🔍
          </span>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={initial.q}
            placeholder="Try “Santos”, “Calculus”, “CCS”, or “Room 204”"
            autoComplete="off"
            className="field py-3 pl-10 text-base"
          />
        </div>
        <button type="submit" className="btn btn-primary py-3 sm:px-6">
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label htmlFor="department" className="label">
            Department
          </label>
          <select
            id="department"
            name="department"
            defaultValue={initial.department}
            onChange={submit}
            className="field"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="building" className="label">
            Building
          </label>
          <select
            id="building"
            name="building"
            defaultValue={initial.building}
            onChange={submit}
            className="field"
          >
            <option value="">Anywhere on campus</option>
            {buildings.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="day" className="label">
            Free on
          </label>
          <select id="day" name="day" defaultValue={initial.day} onChange={submit} className="field">
            <option value="">Any day</option>
            {SHORT_WEEKDAYS.map((short, index) => (
              <option key={index} value={String(index)}>
                {short}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label
            htmlFor="openNow"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-raise"
          >
            <input
              id="openNow"
              name="openNow"
              type="checkbox"
              value="1"
              defaultChecked={initial.openNow}
              onChange={submit}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            Available now
          </label>
        </div>
      </div>
    </form>
  );
}
