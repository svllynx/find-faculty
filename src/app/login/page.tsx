import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Faculty sign in",
  description: "Faculty and department staff sign in to keep office-hour information current.",
};

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight">Faculty &amp; staff sign in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Students do not need an account — the directory is open to everyone. Sign in only to update
        office hours or availability.
      </p>

      <div className="card mt-6 p-5 sm:p-6">
        <LoginForm />
      </div>

      <div className="card mt-4 bg-raise/60 p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Demo accounts</h2>
        <ul className="mt-2 space-y-1 text-ink-soft">
          <li>
            <code className="text-[13px]">admin@campus.edu.ph</code> / admin1234 — department admin
          </li>
          <li>
            <code className="text-[13px]">jsantos@campus.edu.ph</code> / faculty1234 — faculty
          </li>
        </ul>
      </div>
    </div>
  );
}
