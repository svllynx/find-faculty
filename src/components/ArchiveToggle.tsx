"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Archive / restore a faculty record. Archiving is a soft delete: it removes the
 * entry from student searches but keeps the row and its change history, so a
 * record can come back when someone returns from leave.
 */
export default function ArchiveToggle({
  facultyId,
  name,
  active,
}: {
  facultyId: number;
  name: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function apply(nextActive: boolean) {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/faculty/${facultyId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Could not change the record.");
    } else {
      setConfirming(false);
      router.refresh();
    }
    setBusy(false);
  }

  if (!active) {
    return (
      <div>
        <p className="text-sm text-muted">
          This record is archived — students cannot find it.
        </p>
        <button
          type="button"
          onClick={() => apply(true)}
          disabled={busy}
          className="btn btn-quiet mt-2"
        >
          {busy ? "Restoring…" : "Restore to the directory"}
        </button>
        {error && <p className="mt-2 text-sm font-medium text-shut">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {confirming ? (
        <div className="rounded-lg border border-shut/30 bg-shut-soft p-3">
          <p className="text-sm font-medium text-shut">
            Archive {name}? Students will no longer find this record. The change history is kept and
            you can restore it later.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => apply(false)}
              disabled={busy}
              className="btn bg-shut text-white hover:opacity-90"
            >
              {busy ? "Archiving…" : "Yes, archive"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-quiet">
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-quiet text-shut">
          Archive this record
        </button>
      )}
      {error && <p className="mt-2 text-sm font-medium text-shut">{error}</p>}
    </div>
  );
}
