import { categoryIconPath } from "../placeCategories";

/** A place type's icon (placeCategories.ts), stroked in `color`. */
export default function CategoryIcon({ type, color, size = 14 }: { type: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={categoryIconPath(type)} />
    </svg>
  );
}
