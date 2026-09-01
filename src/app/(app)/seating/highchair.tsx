// v2.10.0: shared minimal high-chair icon for the seating plan. The
// same silhouette is used two ways:
//   • the SVG canvas (SeatingCanvas) inlines HIGH_CHAIR_PATH into a
//     seat-adjacent badge, scaled in SVG userspace;
//   • the list view (TableCard) + guest detail panel use the
//     <HighChairIcon> HTML component.
// Drawn as a side-profile high chair — tall splayed legs + a tray —
// so it reads as a *high* chair (not a dining chair) at ~14px.

// Path in a local coordinate box roughly x∈[-2.5,3.8], y∈[-4,4].
export const HIGH_CHAIR_PATH =
  "M-1.5,-4 L-1.5,0 L2,0 M2,0 L2,-1.6 L3.8,-1.6 M-1.5,0 L-2.5,4 M2,0 L3,4 M-1,2.4 L2.4,2.4";

export function HighChairIcon({
  className = "",
  title = "Needs a high chair",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="-3.5 -5.5 8.5 11"
      width="1em"
      height="1em"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{title}</title>
      <path d={HIGH_CHAIR_PATH} />
    </svg>
  );
}
