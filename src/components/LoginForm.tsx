"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? "Could not sign you in. Please try again.");
      setBusy(false);
      return;
    }

    router.replace(payload.user?.role === "admin" ? "/admin" : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          Campus email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-shut-soft px-3 py-2 text-sm font-medium text-shut">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
