'use client'

import type { WatershedBoundary } from '@agriminds/api-types'

type Bbox = [number, number, number, number]

/**
 * The real catchment outline, drawn over the cell grid.
 *
 * Alignment: the grid lays `rows x cols` equal tracks across the geographic box the forecast
 * covers, so a longitude maps to `(lon - lonMin) / lonSpan * cols` and a latitude to
 * `(latMax - lat) / latSpan * rows` — exactly the cell coordinates. Drawing in those units with
 * `viewBox="0 0 cols rows"` puts the outline on the cells without measuring a single pixel. The
 * box projected against is the grid's own, not the boundary's, so the two cannot drift apart.
 * The grid uses no CSS gap (each cell insets its own margin) to keep the tracks contiguous; a
 * gap would shift every cell centre away from its track and skew the overlay.
 *
 * The box is not square in degrees — about 1.52 of longitude by 1.42 of latitude — and the cells
 * are drawn square, so the map is already stretched. `preserveAspectRatio="none"` stretches the
 * outline by the same factors, which is what keeps the two in register.
 */
export function CatchmentOutline({
  boundary,
  bbox,
  rows,
  cols,
  label,
}: {
  boundary: WatershedBoundary
  bbox: Bbox
  rows: number
  cols: number
  label: string
}) {
  const path = outlinePath(boundary.geometry, bbox, rows, cols)
  if (!path) return null
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
      role="img"
      aria-label={label}
      data-testid="catchment-outline"
    >
      {/* A halo beneath the line keeps it legible over both the pale cells and the saturated ones. */}
      <path
        d={path}
        fill="none"
        className="stroke-surface-raised"
        strokeWidth={4}
        strokeOpacity={0.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill="none"
        className="stroke-fg"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

type Point = [number, number]

/** GeoJSON arrives as a loose object, so the coordinate rings are narrowed before they are used. */
function ringsOf(geometry: WatershedBoundary['geometry']): Point[][] {
  const coordinates = (geometry as { coordinates?: unknown }).coordinates
  if (!Array.isArray(coordinates)) return []
  // A Polygon nests one level (rings of points), a MultiPolygon two; flatten to a list of rings.
  const rings = coordinates.flatMap((part) =>
    Array.isArray(part) && Array.isArray(part[0]) && Array.isArray(part[0][0]) ? part : [part],
  )
  return rings
    .filter((ring): ring is unknown[] => Array.isArray(ring))
    .map((ring) =>
      ring.filter(
        (point): point is Point =>
          Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]),
      ),
    )
    .filter((ring) => ring.length >= 3)
}

/** Projects the outline into cell units. Exported so the projection can be asserted directly. */
export function outlinePath(
  geometry: WatershedBoundary['geometry'],
  bbox: Bbox,
  rows: number,
  cols: number,
): string | null {
  const [lonMin, latMin, lonMax, latMax] = bbox
  const lonSpan = lonMax - lonMin
  const latSpan = latMax - latMin
  if (!(lonSpan > 0) || !(latSpan > 0)) return null

  const rings = ringsOf(geometry)
  if (!rings.length) return null

  return rings
    .map(
      (ring) =>
        `${ring
          .map(([lon, lat], i) => {
            const x = (((lon - lonMin) / lonSpan) * cols).toFixed(3)
            const y = (((latMax - lat) / latSpan) * rows).toFixed(3)
            return `${i === 0 ? 'M' : 'L'}${x} ${y}`
          })
          .join(' ')} Z`,
    )
    .join(' ')
}
