"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Sign-out is a POST so it cannot be triggered by a stray link or prefetch;
 * the server drops the session row and the cookie.
 */
export default function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    start(() => {
      router.replace("/");
      router.refresh();
    });
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy || pending}
      className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-raise disabled:opacity-50"
    >
      {busy || pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
