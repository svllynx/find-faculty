import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, DoorOpen } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/lib/db";
import {
  facultyInRoom,
  listDepartments,
  listFloors,
  listRooms,
  primaryBuilding,
  floorLabel,
} from "@/lib/faculty";
import FloorMap from "@/components/FloorMap";
import StatusBadge from "@/components/StatusBadge";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Building map",
  description: "The inside of the CCIS building, floor by floor, room by room.",
};

const KIND_LABEL: Record<string, string> = {
  office: "Faculty office",
  lab: "Laboratory",
  lecture: "Lecture room",
  facility: "Facility",
};

type Search = { floor?: string; room?: string };

export default async function MapPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const db = getDb();

  const building = primaryBuilding(db);
  const floors = listFloors(db);
  const requested = Number(params.floor);
  const floor = floors.includes(requested) ? requested : (floors[0] ?? 1);
  const rooms = listRooms(db, floor);
  const departments = listDepartments(db);

  const selected = rooms.find((r) => r.number === params.room) ?? null;
  const occupants = selected ? facultyInRoom(db, selected.id) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <span className="eyebrow">Floor plan</span>
      <h1 className="mt-4 text-3xl tracking-tight sm:text-4xl">
        Inside the {building?.name ?? "CCIS Building"}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] text-ink-soft">
        Finding the building is the easy part. This is the corridor you actually have to walk —
        tap a room to see whose office it is and when they hold office hours.
      </p>

      {building && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Landmark</dt>
            <dd className="flex items-center gap-1.5 text-ink-soft">
              <MapPin aria-hidden="true" weight="light" className="shrink-0 text-muted" size={16} />
              {building.landmark}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Entrance</dt>
            <dd className="flex items-center gap-1.5 text-muted">
              <DoorOpen aria-hidden="true" weight="light" className="shrink-0" size={16} />
              {building.entrance}
            </dd>
          </div>
        </dl>
      )}

      {floors.length > 1 && (
        <nav aria-label="Floor" className="mt-6 flex flex-wrap gap-2">
          {floors.map((f) => (
            <Link
              key={f}
              href={`/map?floor=${f}`}
              aria-current={f === floor ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-300 ease-[var(--ease-premium,cubic-bezier(.32,.72,0,1))] ${
                f === floor
                  ? "border-brand bg-brand text-white shadow-[0_10px_20px_-10px_rgba(36,57,122,0.6)]"
                  : "border-line bg-surface text-ink-soft hover:-translate-y-px hover:bg-raise"
              }`}
            >
              {floorLabel(f)}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-6">
        <FloorMap
          rooms={rooms}
          floor={floor}
          buildingName={building?.name ?? "CCIS Building"}
          highlightRoomId={selected?.id ?? null}
          hrefFor={(room) => `/map?floor=${floor}&room=${room.number}`}
        />
      </div>

      {/* ── Selected room ─────────────────────────────────────────────────── */}
      {selected && (
        <section className="card mt-6 p-5" aria-labelledby="room-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="room-heading" className="text-lg font-semibold">
              Room {selected.number}
              {selected.name ? ` — ${selected.name}` : ""}
            </h2>
            <Link href={`/map?floor=${floor}`} className="text-sm font-semibold text-brand hover:text-brand-ink">
              Clear selection
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted">
            {KIND_LABEL[selected.kind] ?? selected.kind} · {floorLabel(selected.floor)}
            {selected.note ? ` · ${selected.note}` : ""}
          </p>

          {occupants.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No faculty member has this room as their office.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {occupants.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={f.full_name} photo={f.photo_url} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/faculty/${f.id}`}
                      className="font-semibold text-ink hover:text-brand"
                    >
                      {f.full_name}
                    </Link>
                    <p className="text-sm text-muted">
                      {f.title}
                      {f.title && f.department_code ? " · " : ""}
                      {f.department_code}
                    </p>
                  </div>
                  <StatusBadge availability={f.availability} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Room directory ────────────────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="rooms-heading">
        <h2 id="rooms-heading" className="text-lg font-semibold">
          Rooms on this floor
        </h2>
        <ul data-reveal-group className="mt-4 grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <li key={room.id} data-reveal className="card hover-lift p-4">
              <h3 className="flex items-baseline gap-2 text-base font-semibold">
                <Link
                  href={`/map?floor=${floor}&room=${room.number}`}
                  className="text-ink hover:text-brand"
                >
                  Room {room.number}
                </Link>
                <span className="text-sm font-normal text-muted">{room.name}</span>
              </h3>
              <p className="mt-1.5 text-sm text-muted">
                {KIND_LABEL[room.kind] ?? room.kind} ·{" "}
                {room.occupants === 0
                  ? "no faculty office"
                  : `${room.occupants} faculty ${room.occupants === 1 ? "member" : "members"}`}
              </p>
              {room.note && <p className="mt-1 text-xs text-muted">{room.note}</p>}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Departments ───────────────────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="departments-heading">
        <h2 id="departments-heading" className="text-lg font-semibold">
          CCIS departments
        </h2>
        <p className="mt-1 text-sm text-muted">
          If a professor is not in and it cannot wait, the department office is the next stop.
        </p>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {departments.map((d) => (
            <li key={d.code} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
              <Link
                href={`/search?department=${d.code}`}
                className="text-sm font-semibold text-ink hover:text-brand"
              >
                {d.name}
              </Link>
              <span className="text-xs font-bold text-muted">{d.code}</span>
              <span className="ml-auto text-sm text-ink-soft">
                {d.building_name ?? "—"}
                {d.office ? ` · ${d.office}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
