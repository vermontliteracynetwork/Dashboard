import type { CSSProperties } from 'react';
import type { Sheet } from './catalog';

// One frame-strip animation from a sprite sheet, cropped to the drawing (bbox) so every sprite
// fills its box the same way whatever its sheet's cell size. Width comes from the parent.
export default function SheetSprite({ sheet, className = '', style }: { sheet: Sheet; className?: string; style?: CSSProperties }) {
  const [x0, y0, x1, y1] = sheet.bbox;
  const bw = x1 - x0, bh = y1 - y0;
  const cols = sheet.imgW / sheet.cellW, rows = sheet.imgH / sheet.cellH;
  const vars = {
    '--fx-end': `${(sheet.frames / Math.max(1, cols - 1)) * 100}%`,
    animationDuration: `${sheet.frames * (sheet.ms ?? 100)}ms`,
    animationTimingFunction: `steps(${sheet.frames})`,
  } as CSSProperties;
  return (
    <span className={`cd-sheet ${className}`} style={{ aspectRatio: `${bw} / ${bh}`, ...style }} aria-hidden>
      <span
        className="cd-sheet-cell"
        style={{
          width: `${(sheet.cellW / bw) * 100}%`, height: `${(sheet.cellH / bh) * 100}%`,
          left: `${(-x0 / bw) * 100}%`, top: `${(-y0 / bh) * 100}%`,
          backgroundImage: `url("${sheet.src}")`,
          backgroundSize: `${cols * 100}% ${rows * 100}%`,
          backgroundPositionY: rows > 1 ? `${(sheet.row / (rows - 1)) * 100}%` : '0%',
          ...vars,
        }}
      />
    </span>
  );
}
