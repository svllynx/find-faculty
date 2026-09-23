"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Avatar from "./Avatar";

/**
 * Add or replace a profile photo.
 *
 * The picked file is cropped to a square and scaled down to 320px in the
 * browser before it is ever sent, then stored as a data URL. That keeps FIND
 * free of any file storage — which matters, because the deployment target has a
 * read-only filesystem — and keeps a 6 MB phone photo from becoming a 6 MB row.
 */

const OUTPUT_PX = 320;
const QUALITY = 0.82;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_PX;
  canvas.height = OUTPUT_PX;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process that image.");

  // Centre-crop to a square, then scale: the same framing a round avatar shows.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    OUTPUT_PX,
    OUTPUT_PX,
  );
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export default function PhotoUpload({
  facultyId,
  name,
  photo,
}: {
  facultyId: number;
  name: string;
  photo: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(photoUrl: string) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/faculty/${facultyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_url: photoUrl }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.issues?.[0]?.message ?? payload.error ?? "Could not save that photo.");
      setPreview(photo); // put the old one back rather than lie about the state
    } else {
      setPreview(photoUrl || null);
      setMessage(photoUrl ? "Photo saved." : "Photo removed.");
      router.refresh();
    }
    setBusy(false);
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again after an error
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("That image is very large. Please choose one under 8 MB.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const dataUrl = await toSquareDataUrl(file);
      setPreview(dataUrl);
      await save(dataUrl);
    } catch {
      setError("That image could not be read. Try a JPG or PNG.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} photo={preview} size="lg" />

      <div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPick}
          className="sr-only"
          id={`photo-${facultyId}`}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="btn btn-primary"
          >
            {busy ? "Saving…" : preview ? "Change photo" : "Add a photo"}
          </button>
          {preview && (
            <button type="button" onClick={() => save("")} disabled={busy} className="btn btn-quiet">
              Remove
            </button>
          )}
        </div>

        <p className="mt-2 max-w-sm text-xs text-muted">
          Optional. Square crop, scaled to {OUTPUT_PX}px in your browser before it is uploaded.
          Students see your initials until you add one.
        </p>

        <p aria-live="polite" className="mt-1 min-h-4 text-xs">
          {error && <span className="font-medium text-shut">{error}</span>}
          {message && !error && <span className="font-medium text-open">{message}</span>}
        </p>
      </div>
    </div>
  );
}
