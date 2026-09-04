import { currentUser } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — who the browser is signed in as, if anyone. */
export async function GET() {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  return ok({
    user: {
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      facultyId: user.faculty_id,
    },
  });
}
