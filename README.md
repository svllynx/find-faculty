# FIND — Faculty Information & Navigate Direction

A centralized web directory that answers one question a student asks constantly:
**"Where and when can I find Professor ___?"**

Instead of asking classmates, walking the halls, or checking each department's
bulletin board, a student searches once and gets the office, the office hours,
the current availability and the walking directions on one page.

**Live demo: https://find-faculty-tau.vercel.app**
Sign in as `admin@campus.edu.ph` / `admin1234` to try the maintainer side. The
demo's data is temporary and resets on its own — see [Deployment](#deployment).

## What FIND is — and is not

FIND is an **information and scheduling system**, not a tracking system.

It will tell a student:

> **Juan Santos** — Associate Professor, College of Computer Studies
> 📍 Faculty Building — Room 204
> 🕐 Office Hours: Mon & Wed 1:00 PM – 3:00 PM, Fri 9:00 AM – 11:00 AM
> 🟡 In office hours

It will **never** claim to know that someone is physically inside a room. There is
no sensor, no check-in scan, no device lookup, and no inference anywhere in the
codebase. A status can only come from two places:

| Source | Badge | Meaning |
|---|---|---|
| The faculty member posted it themselves | 🟢 Available / 🔴 Unavailable | "They said so" |
| Their published office-hours schedule | 🟡 In office hours | "Their timetable says so — expected, not confirmed" |
| Neither | ⚪ Outside office hours / No schedule posted | Nothing is being claimed |

Every badge in the UI states which of these it came from, so a student can judge
how much to trust it before walking across campus. This rule is enforced in one
place — [`src/lib/availability.ts`](src/lib/availability.ts) — and pinned down by
the tests in [`src/tests/availability.test.ts`](src/tests/availability.test.ts).

## Who uses it

| Role | Signs in? | Can do |
|---|---|---|
| **Student** | No | Search, view offices, hours, availability and directions |
| **Faculty** | Yes | Publish their own office hours, post their own availability, keep their office/contact details current |
| **Department admin** | Yes | Everything above for any record, plus add/rename/archive records and read the change log |

## Running it

Requires **Node 24** (FIND uses Node's built-in `node:sqlite`, so there is no
database server to install and no native module to compile).

```bash
npm install
npm run seed     # creates data/find.db with a demo campus
npm run dev      # http://localhost:3100
```

Demo accounts created by the seed:

| Email | Password | Role |
|---|---|---|
| `admin@campus.edu.ph` | `admin1234` | Department admin |
| `jsantos@campus.edu.ph` | `faculty1234` | Faculty (Juan Santos) |
| `mcreyes@campus.edu.ph` | `faculty1234` | Faculty (Maria Clara Reyes) |

> These are demo credentials for a local database. Replace them before FIND goes
> anywhere near a real campus network.

### All the commands

```bash
npm run dev        # dev server on :3100
npm run build      # production build
npm run start      # production server on :3100
npm run seed       # reset the database to the demo campus (ids are stable)
npm test           # 92 unit tests (Vitest)
npm run smoke      # 67 end-to-end checks against a running server
npm run typecheck  # tsc --noEmit
```

## Deployment

The live demo is a Vercel deployment. Two things are worth knowing about it:

**Its data is temporary.** A serverless instance can only write to the system
temp directory, and every cold start gets a fresh one, so FIND seeds the demo
campus on boot and edits survive only as long as that instance. The site says so
in a banner. That makes it a genuinely usable demo — search, sign in, publish
office hours, post availability — without pretending to be a system of record.

Because each serverless instance keeps its own copy, a signed-in session lives
on the instance that created it. If a request lands on a different instance you
may be asked to sign in again. That is a property of the temporary storage, not
of the auth code — a shared database removes it.

**Making it permanent** means giving it a database that outlives the instance.
The data layer is deliberately narrow: `src/lib/db.ts` plus the queries in
`faculty.ts` and `mutations.ts`. Either

- run it on a host with a persistent disk (a campus VM, Fly.io volume, Render
  disk) and set `FIND_DB_PATH` to a path on that disk — no code change at all; or
- swap `node:sqlite` for hosted libSQL/Turso, which speaks the same SQL dialect,
  so the schema and every query survive and only the connection becomes async.

Set `FIND_AUTOSEED=0` once a real database is in place, so FIND never writes
demo records into it.

## Pages

| Route | For | What it does |
|---|---|---|
| `/` | Students | One search box + filters (department, building, weekday, "available now") |
| `/faculty/[id]` | Students | Office, weekly hours table, live availability, numbered walking directions, campus map with the building pinned |
| `/map` | Students | Schematic campus plan, building landmarks/entrances, department offices |
| `/login` | Staff | Faculty and admin sign-in |
| `/dashboard` | Faculty | Post availability, edit weekly office hours, update office details |
| `/admin` | Admin | All records (incl. archived), add/rename/archive, edit anyone's hours, change log |

The search is a plain GET form, so **every result set is a shareable URL** and the
page still works with JavaScript disabled.

## API

Read endpoints are public; every write requires a session.

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/faculty?q=&department=&building=&day=&openNow=1` | Anyone |
| `GET` | `/api/faculty/:id` | Anyone |
| `GET` | `/api/departments`, `/api/buildings` | Anyone |
| `POST` | `/api/auth/login`, `/api/auth/logout`, `GET /api/auth/me` | Anyone |
| `PATCH` | `/api/faculty/:id` | Own record, or admin |
| `PUT` | `/api/faculty/:id/hours` | Own record, or admin |
| `POST` | `/api/faculty/:id/status` | Own record, or admin |
| `POST` | `/api/faculty` | Admin |
| `POST` | `/api/faculty/:id/archive` | Admin |
| `GET` | `/api/audit` | Admin |

`GET /api/faculty?q=Santos` returns:

```json
{
  "count": 1,
  "results": [{
    "id": 1,
    "name": "Juan Santos",
    "title": "Associate Professor",
    "department": "College of Computer Studies",
    "office": {
      "building": "Faculty Building", "buildingCode": "FB",
      "room": "204", "floor": "2nd floor",
      "label": "Faculty Building — Room 204",
      "landmark": "Behind the Main Quadrangle, beside the flagpole",
      "entrance": "Main entrance faces the quadrangle; the stairs are on your left as you enter"
    },
    "subjects": ["Data Structures", "Algorithms", "CS Thesis 1"],
    "officeHours": [{ "weekday": 1, "start_minute": 780, "end_minute": 900, "location_note": "" }],
    "availability": {
      "state": "office_hours", "source": "schedule", "label": "In office hours",
      "dot": "amber", "selfReported": false,
      "detail": "Scheduled office hours until 3:00 PM. Expected in office — not confirmed by them."
    }
  }]
}
```

## Architecture

```
src/
  lib/
    schema.mjs        the whole data model, applied idempotently on first connect
    campus-seed.mjs   the demo campus, shared by the CLI seeder and boot-time seeding
    db.ts             one SQLite connection + row normalisation + transactions
    availability.ts   PURE: schedule + posted status -> what students see
    time.ts           PURE: campus timezone, minute<->label formatting
    faculty.ts        all reads (search, profile, reference data)
    mutations.ts      all writes, each with its Zod schema, each audit-logged
    password.ts       scrypt hashing (no Next.js import, so scripts can reuse it)
    auth.ts           sessions, cookies, permissions, rate limit, audit helper
    api.ts            shared route plumbing: guards, body parsing, public shapes
  app/
    page.tsx          search
    faculty/[id]/     profile + directions
    map/  login/  dashboard/  admin/
    api/...           the REST layer above
  components/         presentational + the three client editors
  tests/              92 unit tests
scripts/
  seed.mjs            demo campus
  smoke.mjs           67 end-to-end checks
```

### Data model notes

- **Office hours are integers**, not strings: `(weekday, start_minute, end_minute)`.
  "Is a window open right now?" is then an indexed integer comparison, and
  formatting is a display concern.
- **Availability is derived**, never stored, except for the voluntary
  `manual_status` override — which carries a `manual_until` expiry so a status
  forgotten on a Friday is not still misleading students on Monday.
- **Archiving is a soft delete.** The row and its history stay; the record just
  leaves student search. Someone back from leave is restored, not re-typed.
- **Every write is audit-logged** with the actor's email, so a department can
  verify its directory is actually being maintained.

### Security

- Passwords: scrypt, 16-byte per-user salt, timing-safe comparison.
- Sessions: 256-bit opaque random ids in an `HttpOnly`, `SameSite=Lax` cookie
  (`Secure` in production); server-side expiry; deleted on sign-out.
- Login: identical response for a wrong password and an unknown email, so the
  endpoint cannot enumerate accounts; rate-limited per email and per client.
- Authorization is checked per request, not per page: a faculty member editing
  someone else's record gets a 403 from the API even if they craft the call by
  hand. `npm run smoke` asserts all nine of those refusals.
- Every query is parameterized, and search text has its LIKE metacharacters
  escaped, so `%` finds a literal percent sign instead of the whole directory.
- Writes require a JSON body and a same-site cookie, which is what keeps a
  cross-site form from posting on a signed-in user's behalf.

### Accessibility

WCAG 2.1 AA is the floor: semantic landmarks and headings, a skip link, labels on
every control, a visible focus ring, `aria-live` on search results and on every
save, and `prefers-reduced-motion` respected. Availability is **never** signalled
by colour alone — each badge carries its text label and a differently *shaped*
dot (filled / ringed / barred).

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `FIND_DB_PATH` | `./data/find.db` | SQLite file location |
| `FIND_TZ` | `Asia/Manila` | The campus clock used for every "is it open now" decision |
| `FIND_AUTOSEED` | unset | Set to `0` to stop FIND seeding the demo campus into an empty database |
| `FIND_URL` | `http://localhost:3100` | Target for `npm run smoke` |
