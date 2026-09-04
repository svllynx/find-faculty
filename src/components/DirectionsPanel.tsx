import type { FacultyRecord } from "@/lib/faculty";

/**
 * Turn-by-turn-ish directions, assembled from the building's landmark and
 * entrance notes plus the floor and room. Written as numbered steps because
 * that is how a student actually walks it: find the building, get inside, go up,
 * find the door.
 */
export default function DirectionsPanel({ faculty }: { faculty: FacultyRecord }) {
  if (!faculty.building_name) {
    return (
      <p className="text-sm text-muted">
        No office has been assigned to this record yet. Ask at the{" "}
        {faculty.department_name ?? "department"} office.
      </p>
    );
  }

  const steps = [
    faculty.building_landmark
      ? `Head to the ${faculty.building_name} (${faculty.building_code}) — ${lowerFirst(
          faculty.building_landmark,
        )}.`
      : `Head to the ${faculty.building_name} (${faculty.building_code}).`,
    faculty.building_entrance || "Enter through the main entrance.",
    faculty.floor ? `Go to the ${faculty.floor}.` : null,
    faculty.room
      ? `Look for Room ${faculty.room}${
          faculty.building_code ? ` — the door plate reads ${faculty.building_code}-${faculty.room}` : ""
        }.`
      : null,
  ].filter((step): step is string => Boolean(step));

  return (
    <div>
      <ol className="space-y-2.5">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3 text-sm text-ink-soft">
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink"
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
        Can&rsquo;t find the room? The {faculty.department_name ?? "department"} office can point you
        to it.
      </p>
    </div>
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
