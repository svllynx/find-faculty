import type { Availability } from "@/lib/availability";

/**
 * The availability badge.
 *
 * Colour is never the only signal: every badge carries its text label, and the
 * dot itself differs in shape per state (filled / ringed / barred) so the three
 * states stay distinguishable to a colour-blind reader and in a printout.
 */

const TONE = {
  green: {
    wrap: "bg-open-soft text-open border-open/25",
    dot: "bg-open",
  },
  amber: {
    wrap: "bg-soon-soft text-soon border-soon/25",
    dot: "bg-soon",
  },
  red: {
    wrap: "bg-shut-soft text-shut border-shut/25",
    dot: "bg-shut",
  },
  gray: {
    wrap: "bg-raise text-ink-soft border-line",
    dot: "bg-muted",
  },
} as const;

function Dot({ dot }: { dot: Availability["dot"] }) {
  const tone = TONE[dot];
  if (dot === "red") {
    // A barred dot for "unavailable".
    return (
      <span aria-hidden="true" className="relative grid h-2.5 w-2.5 place-items-center">
        <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
        <span className="absolute h-[1.5px] w-3.5 rotate-45 rounded bg-shut-soft" />
      </span>
    );
  }
  if (dot === "amber") {
    // A ringed dot for "in office hours".
    return (
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full border-2 border-soon bg-soon-soft`}
      />
    );
  }
  return <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />;
}

export default function StatusBadge({
  availability,
  size = "md",
}: {
  availability: Availability;
  size?: "sm" | "md";
}) {
  const tone = TONE[availability.dot];
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${tone.wrap} ${pad}`}
    >
      <Dot dot={availability.dot} />
      {availability.label}
    </span>
  );
}

/** The one-line provenance note: did a person say this, or is it the timetable? */
export function SourceNote({ availability }: { availability: Availability }) {
  if (availability.source === "none") return null;
  return (
    <span className="text-xs text-muted">
      {availability.selfReported ? "Posted by the faculty member" : "From their published schedule"}
    </span>
  );
}
