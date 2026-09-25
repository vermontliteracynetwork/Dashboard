import { ICON_CATALOG } from '../lib/iconCatalog';

// Renders a real icon image in place of an emoji placeholder, same pattern
// as AvatarImg for avatars. If `name` has no entry yet in ICON_CATALOG,
// falls back to rendering `fallback` (usually the emoji it's replacing) so
// a not-yet-converted spot never breaks instead of just staying an emoji.
export function Icon({
  name,
  size = 20,
  alt = '',
  fallback,
  style,
}: {
  name: string;
  size?: number;
  alt?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const src = ICON_CATALOG[name];
  if (!src) return <>{fallback ?? null}</>;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}
