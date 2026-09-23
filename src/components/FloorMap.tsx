import Link from "next/link";
import type { RoomWithOccupants } from "@/lib/faculty";

/**
 * A floor plan of the inside of the building.
 *
 * Not a campus map: a student who has found the CCIS building still has to find
 * Room 7, and that is the part nobody can help them with. So this draws the
 * corridor as you actually walk it — rooms down both sides, entrance on the
 * left, stairs and restrooms at the far end — with the destination lit up.
 *
 * Room rectangles come from the `rooms` table (map_x/map_y/map_w/map_h in this
 * 200x104 space), so moving a room on the map is a row edit, not a code change.
 * The corridor, entrance and stairs are building structure and are drawn here.
 */

const VIEW_W = 200;
const VIEW_H = 104;
const CORRIDOR_TOP = 43;
const CORRIDOR_BOTTOM = 61;
const END_BLOCK_X = 174;
const END_BLOCK_W = 22;

const KIND_FILL: Record<string, string> = {
  office: "#ffffff",
  lab: "#f2f6fd",
  lecture: "#fbf7f1",
  facility: "#f4f5f7",
};

/**
 * Break a room name into lines short enough to sit inside its rectangle.
 * Overflow is elided rather than dropped: "Computer Laboratory 1" and
 * "Computer Laboratory 2" must not both render as "Computer Laboratory".
 */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, maxChars - 1))}…`;
  return kept;
}

function Stairs({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const steps = 5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1" fill="#f4f5f7" stroke="#c3ccdd" strokeWidth="0.5" />
      {Array.from({ length: steps }, (_, i) => (
        <line
          key={i}
          x1={x + 3}
          x2={x + w - 3}
          y1={y + 8 + (i * (h - 14)) / (steps - 1)}
          y2={y + 8 + (i * (h - 14)) / (steps - 1)}
          stroke="#c3ccdd"
          strokeWidth="0.6"
        />
      ))}
      <text x={x + w / 2} y={y + 5.5} textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#667694">
        STAIRS
      </text>
    </g>
  );
}

export default function FloorMap({
  rooms,
  floor,
  buildingName,
  highlightRoomId,
  hrefFor,
}: {
  rooms: RoomWithOccupants[];
  floor: number;
  buildingName: string;
  /** The room to light up as the destination. */
  highlightRoomId?: number | null;
  /** Makes each room a link. Return null to leave a room unlinked. */
  hrefFor?: (room: RoomWithOccupants) => string | null;
}) {
  const target = rooms.find((r) => r.id === highlightRoomId) ?? null;

  return (
    <figure className="card overflow-hidden">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">
          {buildingName} — {floor === 1 ? "1st" : `${floor}th`} floor
        </h3>
        <p className="text-xs text-muted">
          {target ? (
            <>
              Destination: <strong className="font-semibold text-brand-ink">Room {target.number}</strong>
              {target.name ? ` · ${target.name}` : ""}
            </>
          ) : (
            "Rooms along one corridor. Entrance on the left."
          )}
        </p>
      </figcaption>

      <div className="overflow-x-auto bg-[#eef2f9] p-3">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full min-w-[34rem]"
          role="img"
          aria-label={
            target
              ? `Floor plan of the ${floor === 1 ? "1st" : `${floor}th`} floor of the ${buildingName}, with Room ${target.number} marked as the destination`
              : `Floor plan of the ${floor === 1 ? "1st" : `${floor}th`} floor of the ${buildingName}`
          }
        >
          {/* Outer shell */}
          <rect x="2" y="4" width={VIEW_W - 4} height={VIEW_H - 8} rx="2" fill="#ffffff" stroke="#33405c" strokeWidth="1" />

          {/* Corridor */}
          <rect
            x="3"
            y={CORRIDOR_TOP}
            width={VIEW_W - 6}
            height={CORRIDOR_BOTTOM - CORRIDOR_TOP}
            fill="#e7ecf5"
          />
          <text x={VIEW_W / 2} y={CORRIDOR_TOP + 11.5} textAnchor="middle" fontSize="3.4" fontWeight="700" letterSpacing="1" fill="#8895a8">
            C O R R I D O R
          </text>

          {/* Main entrance: a gap in the left wall, and the way you walk in */}
          <rect x="1" y="47" width="3.5" height="10" fill="#eef2f9" />
          <g>
            <line x1="7" y1="52" x2="17" y2="52" stroke="#b4531a" strokeWidth="1.1" />
            <path d="M17 52 l-3.2 -2.2 v4.4 z" fill="#b4531a" />
            <text x="7" y="49" fontSize="3" fontWeight="700" fill="#b4531a">
              ENTRANCE
            </text>
          </g>

          {/* Stairs and restrooms at the far end of the corridor */}
          <Stairs x={END_BLOCK_X} y={8} w={END_BLOCK_W} h={35} />
          <g>
            <rect x={END_BLOCK_X} y={61} width={END_BLOCK_W} height="35" rx="1" fill="#f4f5f7" stroke="#c3ccdd" strokeWidth="0.5" />
            <text x={END_BLOCK_X + END_BLOCK_W / 2} y="77" textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#667694">
              REST
            </text>
            <text x={END_BLOCK_X + END_BLOCK_W / 2} y="81.5" textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#667694">
              ROOMS
            </text>
          </g>

          {/* Rooms */}
          {rooms.map((room) => {
            const isTarget = room.id === highlightRoomId;
            const href = hrefFor?.(room) ?? null;
            const nameLines = wrap(room.name, 17, 3);
            const labelFill = isTarget ? "#ffffff" : "#33405c";
            const subFill = isTarget ? "#c9d3f5" : "#8895a8";

            const body = (
              <g>
                <rect
                  x={room.map_x}
                  y={room.map_y}
                  width={room.map_w}
                  height={room.map_h}
                  rx="1"
                  fill={isTarget ? "#24397a" : KIND_FILL[room.kind] ?? "#ffffff"}
                  stroke={isTarget ? "#1a2a5c" : "#c3ccdd"}
                  strokeWidth={isTarget ? "1" : "0.5"}
                />
                <text
                  x={room.map_x + room.map_w / 2}
                  y={room.map_y + 12}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="800"
                  fill={labelFill}
                >
                  {room.number}
                </text>
                {nameLines.map((line, i) => (
                  <text
                    key={i}
                    x={room.map_x + room.map_w / 2}
                    y={room.map_y + 18.5 + i * 3.6}
                    textAnchor="middle"
                    fontSize="2.9"
                    fill={labelFill}
                    opacity={isTarget ? 1 : 0.85}
                  >
                    {line}
                  </text>
                ))}
                {room.occupants > 0 && (
                  <text
                    x={room.map_x + room.map_w / 2}
                    y={room.map_y + room.map_h - 3.5}
                    textAnchor="middle"
                    fontSize="2.8"
                    fontWeight="600"
                    fill={subFill}
                  >
                    {room.occupants} faculty
                  </text>
                )}
                {isTarget && (
                  <g>
                    <circle cx={room.map_x + room.map_w - 4.5} cy={room.map_y + 4.5} r="2.6" fill="#b4531a" />
                    <circle cx={room.map_x + room.map_w - 4.5} cy={room.map_y + 4.5} r="1" fill="#ffffff" />
                  </g>
                )}
              </g>
            );

            // A door mark on the corridor side, so the plan reads as a building.
            const doorY = room.map_y < CORRIDOR_TOP ? room.map_y + room.map_h : room.map_y;
            const door = (
              <line
                x1={room.map_x + room.map_w / 2 - 3}
                x2={room.map_x + room.map_w / 2 + 3}
                y1={doorY}
                y2={doorY}
                stroke={isTarget ? "#b4531a" : "#8895a8"}
                strokeWidth="1.2"
              />
            );

            return (
              <g key={room.id}>
                {href ? (
                  <Link href={href} aria-label={`Room ${room.number}, ${room.name}`}>
                    <g className="cursor-pointer">{body}</g>
                  </Link>
                ) : (
                  body
                )}
                {door}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="border-t border-line bg-surface px-4 py-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          {[
            ["office", "Faculty office"],
            ["lab", "Laboratory"],
            ["lecture", "Lecture room"],
          ].map(([kind, label]) => (
            <li key={kind} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-4 rounded-sm border border-line"
                style={{ background: KIND_FILL[kind] }}
              />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm bg-brand" />
            Destination
          </li>
        </ul>
      </div>
    </figure>
  );
}
