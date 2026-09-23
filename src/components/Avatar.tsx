/**
 * The profile picture, with a placeholder that stands in until someone adds one.
 *
 * The placeholder is initials on a tinted disc rather than a generic silhouette,
 * so a directory with no photos in it still looks finished and every entry stays
 * visually distinct. A photo is a plain <img>: the stored value is usually an
 * inline data URL, which nothing can optimise further.
 */

const SIZES = {
  sm: { box: "h-11 w-11", text: "text-sm" },
  md: { box: "h-16 w-16", text: "text-lg" },
  lg: { box: "h-24 w-24", text: "text-2xl" },
  xl: { box: "h-32 w-32", text: "text-3xl" },
} as const;

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Avatar({
  name,
  photo,
  size = "sm",
  className = "",
}: {
  name: string;
  photo?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, text } = SIZES[size];
  const shared = `${box} shrink-0 rounded-full object-cover ${className}`;

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={`${name}'s profile photo`}
        className={`${shared} border border-line bg-raise`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={`${name} — no profile photo yet`}
      title="No profile photo yet"
      className={`${shared} grid place-items-center border border-brand-soft bg-brand-soft font-bold text-brand-ink ${text}`}
    >
      {initialsOf(name) || "?"}
    </span>
  );
}
