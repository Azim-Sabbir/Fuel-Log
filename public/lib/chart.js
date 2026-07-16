// Hand-rolled SVG chart geometry — dependency-free, pure (browser + Vitest).
// The viewBox has y=0 at the top, so bar/line y-values are measured from the top.

/** Bar rectangles scaled to the max value. Returns [{ x, y, w, h }]. */
export function barGeometry(values, { width, height, gap = 0 }) {
  const n = values.length;
  if (n === 0) return [];
  const max = Math.max(...values, 0);
  const bw = (width - gap * (n - 1)) / n;
  return values.map((v, i) => {
    const h = max > 0 ? (v / max) * height : 0;
    return { x: i * (bw + gap), y: height - h, w: bw, h };
  });
}

/** Polyline points ("x,y x,y ...") spread across the width, y scaled to max. */
export function linePoints(values, { width, height }) {
  const n = values.length;
  if (n === 0) return "";
  const max = Math.max(...values, 0);
  return values
    .map((v, i) => {
      const x = n === 1 ? 0 : (i * width) / (n - 1);
      const y = max > 0 ? height - (v / max) * height : height;
      return `${x},${y}`;
    })
    .join(" ");
}
