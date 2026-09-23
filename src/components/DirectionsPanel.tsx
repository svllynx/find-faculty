import type { FacultyRecord } from "@/lib/faculty";

/**
 * Directions, written as the walk actually goes: find the building, get in,
 * reach the right floor, then find the door. The last two steps are the ones a
 * campus map cannot give you, so they carry the room name and any door note.
 */
export default function DirectionsPanel({ faculty }: { faculty: FacultyRecord }) {
  if (!faculty.room_number) {
    return (
      <p className="text-sm text-muted">
        No office has been assigned to this record yet. Ask at the{" "}
        {faculty.department_name ? `${faculty.department_name} department` : "department"} office, or
        email {faculty.full_name.split(/\s+/)[0]} to arrange a place to meet.
      </p>
    );
  }

  const building = faculty.building_name ?? "the building";
  const code = faculty.building_code;

  const steps = [
    faculty.building_landmark
      ? `Head to the ${building}${code ? ` (${code})` : ""} — ${lowerFirst(faculty.building_landmark)}.`
      : `Head to the ${building}${code ? ` (${code})` : ""}.`,
    faculty.building_entrance || "Enter through the main entrance.",
    faculty.room_floor === 1
      ? "Stay on the ground floor and walk into the corridor."
      : `Take the stairs at the far end of the corridor to the ${faculty.floorLabel}.`,
    `Room ${faculty.room_number} is on the ${faculty.room_floor === 1 ? "1st" : faculty.floorLabel} floor corridor${
      faculty.room_name ? ` — the door is signed “${faculty.room_name}”` : ""
    }.${faculty.room_note ? ` ${faculty.room_note}` : ""}`,
  ];

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
        Can&rsquo;t find the room? Room 1 (the CCIS Faculty Office) is the first door on the left and
        can point you to it.
      </p>
    </div>
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
