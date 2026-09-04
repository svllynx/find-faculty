import Link from "next/link";
import type { Building } from "@/lib/faculty";

/**
 * A schematic campus map.
 *
 * Deliberately a hand-drawn plan rather than a real tile map: FIND needs to
 * answer "which building, and where is that relative to things I know", which a
 * simple labelled plan does better than a zoomed-out satellite view — and it
 * needs no external map service, API key, or network call.
 *
 * Buildings are positioned from their map_x / map_y (0-100) columns, so a
 * department can move a pin by editing a row, not this file.
 */
export default function CampusMap({
  buildings,
  highlight,
  counts,
}: {
  buildings: Building[];
  /** Building code to draw as the destination. */
  highlight?: string | null;
  /** Optional faculty-count-per-building, keyed by building code. */
  counts?: Record<string, number>;
}) {
  return (
    <figure className="card overflow-hidden">
      <svg
        viewBox="0 0 100 100"
        className="block h-auto w-full bg-[#eef3ea]"
        role="img"
        aria-label={
          highlight
            ? `Schematic campus map with ${
                buildings.find((b) => b.code === highlight)?.name ?? "the destination"
              } marked`
            : "Schematic campus map of the buildings in the faculty directory"
        }
      >
        {/* Lawns */}
        <rect x="0" y="0" width="100" height="100" fill="#eef3ea" />
        <ellipse cx="47" cy="58" rx="17" ry="11" fill="#dbe8d5" />
        <text x="47" y="59.2" textAnchor="middle" fontSize="2.6" fill="#7c8f76">
          THE OVAL
        </text>

        {/* Walkways */}
        <g stroke="#dcd9cf" strokeWidth="3.2" strokeLinecap="round">
          <line x1="47" y1="96" x2="47" y2="70" />
          <line x1="47" y1="46" x2="47" y2="30" />
          <line x1="10" y1="48" x2="90" y2="48" />
          <line x1="74" y1="48" x2="74" y2="36" />
          <line x1="70" y1="48" x2="70" y2="62" />
          <line x1="24" y1="48" x2="24" y2="54" />
        </g>

        {/* Main gate */}
        <g>
          <rect x="42" y="96.5" width="10" height="2" rx="0.8" fill="#b9b3a5" />
          <text x="47" y="95.2" textAnchor="middle" fontSize="2.4" fill="#6d6a61">
            MAIN GATE
          </text>
        </g>

        {/* Buildings */}
        {buildings.map((b) => {
          const isTarget = b.code === highlight;
          const w = 17;
          const h = 11;
          const x = Math.min(Math.max(b.map_x - w / 2, 1), 100 - w - 1);
          const y = Math.min(Math.max(b.map_y - h / 2, 1), 100 - h - 1);
          const count = counts?.[b.code];

          return (
            <g key={b.code}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx="1.4"
                fill={isTarget ? "#24397a" : "#ffffff"}
                stroke={isTarget ? "#1a2a5c" : "#c9d2c4"}
                strokeWidth={isTarget ? "0.9" : "0.5"}
              />
              <text
                x={x + w / 2}
                y={y + (count ? 4.8 : 6.4)}
                textAnchor="middle"
                fontSize="4"
                fontWeight="700"
                fill={isTarget ? "#ffffff" : "#33405c"}
              >
                {b.code}
              </text>
              {count !== undefined && (
                <text
                  x={x + w / 2}
                  y={y + 8.6}
                  textAnchor="middle"
                  fontSize="2.6"
                  fill={isTarget ? "#c9d3f5" : "#8895a8"}
                >
                  {count} {count === 1 ? "faculty" : "faculty"}
                </text>
              )}
              {isTarget && (
                <g>
                  <circle cx={x + w / 2} cy={y - 3.4} r="2.6" fill="#b4531a" />
                  <circle cx={x + w / 2} cy={y - 3.4} r="1" fill="#ffffff" />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="border-t border-line bg-surface px-4 py-3">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {buildings.map((b) => (
            <li key={b.code}>
              <Link
                href={`/?building=${b.code}`}
                className={`font-medium hover:text-brand ${
                  b.code === highlight ? "text-brand-ink" : "text-muted"
                }`}
              >
                <strong className="font-bold">{b.code}</strong> — {b.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Schematic plan, not to scale. Use the landmark and entrance notes for the last few metres.
        </p>
      </figcaption>
    </figure>
  );
}
