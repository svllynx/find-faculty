/**
 * End-to-end smoke test against a running FIND server.
 *
 * Exercises the whole stack the way the two kinds of user do: a student
 * searching anonymously, then a faculty member signing in and changing their
 * own information — including the cases that must be REFUSED.
 *
 *   npm run start          # in one terminal
 *   npm run smoke          # in another
 */

const BASE = process.env.FIND_URL ?? "http://localhost:3100";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  let body = null;
  const text = await response.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

/** Sign in and return the session cookie string. */
async function signIn(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return { status: response.status, cookie, body: await response.json().catch(() => null) };
}

console.log(`\nFIND smoke test against ${BASE}\n`);

// ── A student, not signed in ──────────────────────────────────────────────────
console.log("Student (anonymous)");
{
  const page = await fetch(`${BASE}/`);
  check("home page renders", page.status === 200);

  const all = await api("/api/faculty");
  check("directory lists faculty", all.status === 200 && all.body.count >= 15, `count=${all.body?.count}`);

  const byName = await api("/api/faculty?q=Santos");
  check(
    "search by surname finds Juan Santos",
    byName.body.results?.some((r) => r.name === "Juan Santos"),
  );

  const bySubject = await api("/api/faculty?q=Algorithms");
  check("search by subject works", bySubject.body.count > 0, `count=${bySubject.body?.count}`);

  const byRoom = await api("/api/faculty?q=1");
  check("search by room number works", byRoom.body.count > 0, `count=${byRoom.body?.count}`);

  const byRoomName = await api("/api/faculty?q=Networking%20Laboratory");
  check("search by room name works", byRoomName.body.count > 0);

  const byDept = await api("/api/faculty?department=CS");
  check("department filter works", byDept.body.count === 5, `count=${byDept.body?.count}`);

  const shortCode = await api("/api/faculty?q=IT");
  check(
    "a short query matches the department code, not every subject containing those letters",
    shortCode.body.results?.every((r) => r.departmentCode === "IT"),
    JSON.stringify(shortCode.body.results?.map((r) => r.departmentCode)),
  );

  const byFloor = await api("/api/faculty?floor=1");
  check("floor filter works", byFloor.body.count >= 14, `count=${byFloor.body?.count}`);
  check(
    "floor filter only returns faculty on that floor",
    byFloor.body.results?.every((r) => r.office.floor === 1),
  );

  const injection = await api(`/api/faculty?q=${encodeURIComponent("'; DROP TABLE faculty; --")}`);
  const stillThere = await api("/api/faculty");
  check(
    "SQL injection attempt is treated as text",
    injection.status === 200 && stillThere.body.count >= 15,
  );

  const profile = await api("/api/faculty/1");
  check("profile has office, hours and availability", Boolean(
    profile.body.office?.label && Array.isArray(profile.body.officeHours) && profile.body.availability?.state,
  ));
  check("profile includes walking directions data", Boolean(profile.body.office?.entrance));
  check("profile names the room, floor and college", Boolean(
    profile.body.office?.room && profile.body.office?.floor && profile.body.college,
  ), JSON.stringify(profile.body.office));
  check("profile starts with no photo, so students see the placeholder", profile.body.photo === null);
  check("profile availability names its source", ["faculty", "schedule", "none"].includes(profile.body.availability?.source));

  const missing = await api("/api/faculty/99999");
  check("unknown faculty id gives 404", missing.status === 404);

  const badId = await api("/api/faculty/abc");
  check("non-numeric faculty id gives 400", badId.status === 400);

  const me = await api("/api/auth/me");
  check("anonymous visitor has no session", me.body.user === null);

  // Writes must be refused outright.
  const write = await api("/api/faculty/1/status", {
    method: "POST",
    body: JSON.stringify({ manual_status: "available" }),
  });
  check("anonymous cannot post a status (401)", write.status === 401, `got ${write.status}`);

  const hours = await api("/api/faculty/1/hours", { method: "PUT", body: JSON.stringify([]) });
  check("anonymous cannot change office hours (401)", hours.status === 401);

  const audit = await api("/api/audit");
  check("anonymous cannot read the audit log (401)", audit.status === 401);
}

// ── A faculty member ─────────────────────────────────────────────────────────
console.log("\nFaculty (jsantos@campus.edu.ph)");
{
  const bad = await signIn("jsantos@campus.edu.ph", "wrong-password");
  check("wrong password is rejected (401)", bad.status === 401);
  check("rejection does not reveal whether the email exists", bad.body?.error === "Incorrect email or password.");

  const unknown = await signIn("nobody@campus.edu.ph", "whatever");
  check("unknown email gives the same message", unknown.body?.error === "Incorrect email or password.");

  const session = await signIn("jsantos@campus.edu.ph", "faculty1234");
  check("correct password signs in", session.status === 200);
  check("session cookie is HttpOnly", true); // asserted below from the raw header
  const auth = { Cookie: session.cookie };

  const me = await api("/api/auth/me", { headers: auth });
  check("session resolves to the right user", me.body.user?.email === "jsantos@campus.edu.ph");
  check("session carries the linked faculty record", me.body.user?.facultyId === 1);

  // Own record: allowed.
  const status = await api("/api/faculty/1/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      manual_status: "available",
      manual_note: "Smoke test — in my office.",
      expires_in_minutes: 60,
    }),
  });
  check("can post own availability", status.status === 200 && status.body.availability?.state === "available");
  check("posted status is marked self-reported", status.body.availability?.selfReported === true);

  const publicView = await api("/api/faculty/1");
  check("students see the posted status", publicView.body.availability?.state === "available");
  check("students see the note", publicView.body.availability?.detail === "Smoke test — in my office.");

  const openNow = await api("/api/faculty?openNow=1");
  check(
    "posting green puts them in the available-now list",
    openNow.body.results?.some((r) => r.id === 1),
  );

  const cleared = await api("/api/faculty/1/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ manual_status: null }),
  });
  check("can clear own status", cleared.status === 200);
  check(
    "cleared status falls back to the schedule",
    cleared.body.availability?.selfReported === false,
  );

  const hours = await api("/api/faculty/1/hours", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify([
      { weekday: 1, start_minute: 780, end_minute: 900, location_note: "" },
      { weekday: 3, start_minute: 780, end_minute: 900, location_note: "" },
      { weekday: 5, start_minute: 540, end_minute: 660, location_note: "" },
    ]),
  });
  check("can replace own office hours", hours.status === 200 && hours.body.officeHours?.length === 3);

  const overlap = await api("/api/faculty/1/hours", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify([
      { weekday: 1, start_minute: 540, end_minute: 720 },
      { weekday: 1, start_minute: 600, end_minute: 780 },
    ]),
  });
  check("overlapping blocks are rejected (422)", overlap.status === 422, `got ${overlap.status}`);

  const backwards = await api("/api/faculty/1/hours", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify([{ weekday: 1, start_minute: 900, end_minute: 780 }]),
  });
  check("end-before-start is rejected (422)", backwards.status === 422);

  const stillThree = await api("/api/faculty/1");
  check("a rejected save left the schedule untouched", stillThree.body.officeHours?.length === 3);

  const rooms = await api("/api/rooms?floor=1");
  check("rooms endpoint returns the floor plan", rooms.body.rooms?.length === 12, `rooms=${rooms.body.rooms?.length}`);
  check("each room carries its map geometry", rooms.body.rooms?.every((r) => typeof r.map_x === "number" && r.map_w > 0));
  check("rooms report how many faculty sit in them", rooms.body.rooms?.some((r) => r.occupants > 0));

  const targetRoom = rooms.body.rooms.find((r) => r.number === "5");
  const profile = await api("/api/faculty/1", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ room_id: targetRoom.id }),
  });
  check("can move own office to another room", profile.status === 200 && profile.body.office?.room === "5");
  check("the floor follows the room", profile.body.office?.floor === 1);

  const badRoom = await api("/api/faculty/1", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ room_id: 99999 }),
  });
  check("a room that does not exist is rejected (422)", badRoom.status === 422, `got ${badRoom.status}`);

  // --- Profile photo ---
  const tinyJpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
  const photo = await api("/api/faculty/1", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ photo_url: tinyJpeg }),
  });
  check("can add a profile photo", photo.status === 200 && photo.body.photo === tinyJpeg);

  const seenByStudent = await api("/api/faculty/1");
  check("students see the photo", seenByStudent.body.photo === tinyJpeg);

  const badPhoto = await api("/api/faculty/1", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ photo_url: "javascript:alert(1)" }),
  });
  check("a non-image photo value is rejected (422)", badPhoto.status === 422, `got ${badPhoto.status}`);

  const removed = await api("/api/faculty/1", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ photo_url: "" }),
  });
  check("can remove the photo again", removed.status === 200 && removed.body.photo === null);

  // --- Absence override ---
  const backOn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const away = await api("/api/faculty/1/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      manual_status: "unavailable",
      manual_note: "Smoke test - away at a seminar.",
      expires_at: backOn,
    }),
  });
  check("can post a week-long absence override", away.status === 200, `got ${away.status}`);
  check("a long absence reads as Away", away.body.availability?.label === "Away");
  check("the override is flagged as a long absence", away.body.availability?.longAbsence === true);
  check("the override carries its end date", away.body.availability?.until === backOn);
  check("the detail leads with the return date", /^Away until /.test(away.body.availability?.detail ?? ""));

  const awaySeen = await api("/api/faculty/1");
  check("students see the absence, not the timetable", awaySeen.body.availability?.state === "unavailable");

  const openWhileAway = await api("/api/faculty?openNow=1");
  check(
    "an away professor is not in the available-now list",
    !openWhileAway.body.results?.some((r) => r.id === 1),
  );

  const pastDate = await api("/api/faculty/1/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      manual_status: "unavailable",
      expires_at: new Date(Date.now() - 86_400_000).toISOString(),
    }),
  });
  check("an end date in the past is rejected (422)", pastDate.status === 422, `got ${pastDate.status}`);

  const tooFar = await api("/api/faculty/1/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      manual_status: "unavailable",
      expires_at: new Date(Date.now() + 500 * 86_400_000).toISOString(),
    }),
  });
  check("an implausibly long override is rejected (422)", tooFar.status === 422);

  await api("/api/faculty/1/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ manual_status: null }),
  });

  const badEmail = await api("/api/faculty/1", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ email: "not-an-email" }),
  });
  check("malformed email is rejected (422)", badEmail.status === 422);

  // Someone else's record: refused.
  const other = await api("/api/faculty/2/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ manual_status: "unavailable" }),
  });
  check("cannot post someone else's availability (403)", other.status === 403, `got ${other.status}`);

  const otherHours = await api("/api/faculty/2/hours", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify([]),
  });
  check("cannot edit someone else's hours (403)", otherHours.status === 403);

  const rename = await api("/api/faculty/1", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ full_name: "Someone Else" }),
  });
  check("faculty cannot rename their own record (403)", rename.status === 403);

  const adminOnly = await api("/api/audit", { headers: auth });
  check("faculty cannot read the audit log (403)", adminOnly.status === 403);

  const create = await api("/api/faculty", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ full_name: "Ghost Professor" }),
  });
  check("faculty cannot create records (403)", create.status === 403);

  const otherPhoto = await api("/api/faculty/2", {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ photo_url: "" }),
  });
  check("cannot change the photo on someone elses record (403)", otherPhoto.status === 403);

  const archive = await api("/api/faculty/2/archive", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ active: false }),
  });
  check("faculty cannot archive records (403)", archive.status === 403);

  await api("/api/auth/logout", { method: "POST", headers: auth });
  const afterLogout = await api("/api/auth/me", { headers: auth });
  check("signing out invalidates the session", afterLogout.body.user === null);

  const afterLogoutWrite = await api("/api/faculty/1/status", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ manual_status: "available" }),
  });
  check("the old cookie cannot write after logout (401)", afterLogoutWrite.status === 401);
}

// ── A department admin ───────────────────────────────────────────────────────
console.log("\nDepartment admin (admin@campus.edu.ph)");
{
  const session = await signIn("admin@campus.edu.ph", "admin1234");
  check("admin signs in", session.status === 200 && session.body.user?.role === "admin");
  const auth = { Cookie: session.cookie };

  const created = await api("/api/faculty", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      full_name: "Smoke Test Lecturer",
      title: "Instructor",
      department_id: 1,
      room_id: 2,
    }),
  });
  check("admin can add a record (201)", created.status === 201, `got ${created.status}`);
  const newId = created.body?.id;

  const found = await api("/api/faculty?q=Smoke%20Test");
  check("the new record is searchable", found.body.count === 1);

  const fresh = await api(`/api/faculty/${newId}`);
  check("a new record has no schedule yet", fresh.body.availability?.state === "no_schedule");

  const anyone = await api(`/api/faculty/${newId}/hours`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify([{ weekday: 2, start_minute: 600, end_minute: 720 }]),
  });
  check("admin can set hours for any record", anyone.status === 200);

  const renamed = await api(`/api/faculty/${newId}`, {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ full_name: "Smoke Test Professor" }),
  });
  check("admin can rename a record", renamed.status === 200 && renamed.body.name === "Smoke Test Professor");

  const badFk = await api(`/api/faculty/${newId}`, {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ department_id: 9999 }),
  });
  check("a nonexistent department is rejected (422)", badFk.status === 422, `got ${badFk.status}`);

  const adminAway = await api(`/api/faculty/${newId}/status`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      manual_status: "unavailable",
      manual_note: "On leave.",
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }),
  });
  check("admin can post a month-long absence for any record", adminAway.status === 200);
  check("it reads as Away to students", adminAway.body.availability?.label === "Away");

  const archived = await api(`/api/faculty/${newId}/archive`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ active: false }),
  });
  check("admin can archive a record", archived.status === 200);

  const gone = await api("/api/faculty?q=Smoke%20Test");
  check("archived records disappear from student search", gone.body.count === 0);

  const goneProfile = await api(`/api/faculty/${newId}`);
  check("an archived profile 404s for students", goneProfile.status === 404);

  const audit = await api("/api/audit", { headers: auth });
  check("admin can read the audit log", audit.status === 200 && audit.body.entries?.length > 0);
  check(
    "the audit log names the actor",
    audit.body.entries?.some((e) => e.actor_email === "admin@campus.edu.ph"),
  );
  check(
    "the audit log recorded the faculty edits too",
    audit.body.entries?.some((e) => e.actor_email === "jsantos@campus.edu.ph"),
  );

  await api("/api/auth/logout", { method: "POST", headers: auth });
}

// ── Reference data + hardening ───────────────────────────────────────────────
console.log("\nReference data & hardening");
{
  const departments = await api("/api/departments");
  check("departments endpoint lists the CCIS departments", departments.body.departments?.length === 3, `n=${departments.body.departments?.length}`);
  check(
    "every department belongs to CCIS",
    departments.body.departments?.every((d) => d.college_code === "CCIS"),
  );

  const buildings = await api("/api/buildings");
  check("buildings endpoint returns the one building", buildings.body.buildings?.length === 1);

  const rooms = await api("/api/rooms");
  check("rooms endpoint lists every mapped room", rooms.body.rooms?.length === 12);
  check("rooms endpoint reports the floors", JSON.stringify(rooms.body.floors) === "[1]");

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@campus.edu.ph", password: "admin1234" }),
  });
  const cookieHeader = (login.headers.getSetCookie?.() ?? []).join(";");
  check("session cookie is HttpOnly", /HttpOnly/i.test(cookieHeader), cookieHeader);
  check("session cookie is SameSite=Lax", /SameSite=lax/i.test(cookieHeader));
  const cookie = cookieHeader.split(";")[0];
  await api("/api/auth/logout", { method: "POST", headers: { Cookie: cookie } });

  const forged = await api("/api/faculty/1/status", {
    method: "POST",
    headers: { Cookie: "find_session=" + "a".repeat(64) },
    body: JSON.stringify({ manual_status: "available" }),
  });
  check("a forged session id is refused (401)", forged.status === 401);

  const notJson = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "this is not json",
  });
  check("a non-JSON body gives 400, not a crash", notJson.status === 400);

  const headers = await fetch(`${BASE}/`);
  check("nosniff header is set", headers.headers.get("x-content-type-options") === "nosniff");

  const pages = await Promise.all(
    ["/", "/map", "/map?room=1", "/login", "/faculty/1", "/nope-does-not-exist"].map((p) =>
      fetch(`${BASE}${p}`).then((r) => [p, r.status]),
    ),
  );
  check(
    "public pages render, unknown paths 404",
    pages.every(([p, status]) => (p === "/nope-does-not-exist" ? status === 404 : status === 200)),
    JSON.stringify(pages),
  );

  const guarded = await Promise.all(
    ["/dashboard", "/admin"].map((p) =>
      fetch(`${BASE}${p}`, { redirect: "manual" }).then((r) => [p, r.status]),
    ),
  );
  check(
    "signed-out visitors are redirected away from the editors",
    guarded.every(([, status]) => status >= 300 && status < 400),
    JSON.stringify(guarded),
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
