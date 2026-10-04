import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">Not found</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        We could not find that faculty member
      </h1>
      <p className="mt-3 text-sm text-ink-soft">
        The record may have been archived, or the link may be out of date. Search the directory
        instead — a surname is usually enough.
      </p>
      <Link href="/search" className="btn btn-primary mt-6">
        Back to faculty search
      </Link>
    </div>
  );
}
