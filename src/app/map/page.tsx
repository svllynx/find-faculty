import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listBuildings, listDepartments, searchFaculty } from "@/lib/faculty";
import CampusMap from "@/components/CampusMap";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campus map",
  description: "Which building holds which department, and how to find it.",
};

export default async function MapPage() {
  const db = getDb();
  const buildings = listBuildings(db);
  const departments = listDepartments(db);
  const faculty = searchFaculty(db, {});

  const counts: Record<string, number> = {};
  for (const f of faculty) {
    if (f.building_code) counts[f.building_code] = (counts[f.building_code] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Campus map</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-ink-soft">
        Which building holds which department. Tap a building to see everyone with an office there.
      </p>

      <div className="mt-6">
        <CampusMap buildings={buildings} counts={counts} />
      </div>

      <section className="mt-8" aria-labelledby="buildings-heading">
        <h2 id="buildings-heading" className="text-lg font-semibold">
          Buildings
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {buildings.map((b) => {
            const here = departments.filter((d) => d.building_code === b.code);
            return (
              <li key={b.code} className="card p-4">
                <h3 className="text-base font-semibold">
                  <Link href={`/?building=${b.code}`} className="text-ink hover:text-brand">
                    {b.name}
                  </Link>
                  <span className="ml-2 rounded bg-raise px-1.5 py-0.5 text-[11px] font-bold text-ink-soft">
                    {b.code}
                  </span>
                </h3>

                <dl className="mt-2.5 space-y-1.5 text-sm">
                  <div>
                    <dt className="sr-only">Landmark</dt>
                    <dd className="text-ink-soft">
                      <span aria-hidden="true" className="mr-1.5 text-muted">
                        📍
                      </span>
                      {b.landmark}
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">Entrance</dt>
                    <dd className="text-muted">
                      <span aria-hidden="true" className="mr-1.5">
                        🚪
                      </span>
                      {b.entrance}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 border-t border-line pt-2.5 text-sm text-muted">
                  {counts[b.code] ?? 0} faculty with offices here
                  {here.length > 0 && (
                    <>
                      {" · "}
                      {here.map((d) => d.code).join(", ")}
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="departments-heading">
        <h2 id="departments-heading" className="text-lg font-semibold">
          Department offices
        </h2>
        <p className="mt-1 text-sm text-muted">
          If a professor is not in and it cannot wait, their department office is the next stop.
        </p>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {departments.map((d) => (
            <li key={d.code} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
              <Link
                href={`/?department=${d.code}`}
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
