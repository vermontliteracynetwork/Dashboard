import { avatarSrc } from '../lib/avatarCatalog';

// Renders a student's avatar. Known catalog ids render as the character
// image; anything else (emoji saved by older data) renders as text so
// existing students don't break.
export function AvatarGlyph({ value, size }: { value: string; size?: number | string }) {
  const src = avatarSrc(value);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size ?? '100%',
          height: size ?? '100%',
          objectFit: 'contain',
          imageRendering: 'pixelated',
        }}
      />
    );
  }
  return <span style={size ? { fontSize: typeof size === 'number' ? size * 0.7 : size } : undefined}>{value}</span>;
}
