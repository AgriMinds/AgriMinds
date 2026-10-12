/**
 * Crop glyphs and belt scenes.
 *
 * The poster carries small illustrations next to every crop and altitude belt, and they do real
 * work: they let someone find "maize in the midlands" without reading three labels. These are
 * inline SVG rather than images so they inherit the type colour, stay sharp at any size, cost no
 * request, and keep working in both themes. They are decorative — every one sits beside its own
 * text label — so they are hidden from assistive technology.
 */

import type { AgroZone, Crop } from '@agriminds/api-types'

type GlyphProps = { className?: string }

function Tef({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden focusable="false">
      <path d="M12 22V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M12 9 7.5 4.5M12 9l4.5-4.5M12 12 6.5 8.5M12 12l5.5-3.5M12 15.5 7 13m5 2.5 5-2.5" />
      </g>
      <g fill="currentColor">
        <circle cx="7.1" cy="4.1" r="1.25" />
        <circle cx="16.9" cy="4.1" r="1.25" />
        <circle cx="6.1" cy="8.1" r="1.1" />
        <circle cx="17.9" cy="8.1" r="1.1" />
        <circle cx="6.6" cy="12.6" r="1" />
        <circle cx="17.4" cy="12.6" r="1" />
      </g>
    </svg>
  )
}

function Wheat({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden focusable="false">
      <path d="M12 22v-8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <g fill="currentColor">
        <ellipse cx="12" cy="3.6" rx="1.5" ry="2.4" />
        <ellipse cx="9.4" cy="6.6" rx="1.4" ry="2.3" transform="rotate(-24 9.4 6.6)" />
        <ellipse cx="14.6" cy="6.6" rx="1.4" ry="2.3" transform="rotate(24 14.6 6.6)" />
        <ellipse cx="9.4" cy="10.4" rx="1.4" ry="2.3" transform="rotate(-24 9.4 10.4)" />
        <ellipse cx="14.6" cy="10.4" rx="1.4" ry="2.3" transform="rotate(24 14.6 10.4)" />
        <ellipse cx="12" cy="8.4" rx="1.4" ry="2.3" />
      </g>
      <path d="M12 17.5c-2.2 0-3.6-1.2-4.2-2.6 1.9-.5 3.4.1 4.2 1.4" fill="currentColor" opacity=".55" />
    </svg>
  )
}

function Maize({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden focusable="false">
      {/* Husk leaves behind the cob, then the cob outline, then the kernel rows. Drawn at the
          same visual weight as the tef and wheat glyphs so the three read as one set. */}
      <path
        d="M9.6 13.6C7.4 13 5.6 13.6 4.3 15.4c2 1.5 4 1.6 5.8.4M14.4 13.6c2.2-.6 4-.1 5.3 1.8-2 1.5-4 1.6-5.8.4"
        fill="currentColor"
        opacity=".35"
      />
      <path
        d="M12 2.8c2.6 1.9 3.9 4.9 3.9 8.6s-1.3 7-3.9 9.2c-2.6-2.2-3.9-5.5-3.9-9.2S9.4 4.7 12 2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <g fill="currentColor">
        <circle cx="12" cy="7" r=".85" />
        <circle cx="10" cy="9.4" r=".85" />
        <circle cx="14" cy="9.4" r=".85" />
        <circle cx="12" cy="11.6" r=".85" />
        <circle cx="10.1" cy="14" r=".85" />
        <circle cx="13.9" cy="14" r=".85" />
        <circle cx="12" cy="16.4" r=".85" />
      </g>
    </svg>
  )
}

const GLYPHS: Record<Crop, (p: GlyphProps) => React.ReactElement> = {
  tef: Tef,
  wheat: Wheat,
  maize: Maize,
}

/** Crop pictogram in the current text colour. Decorative: pair it with the crop's name. */
export function CropGlyph({ crop, className = 'size-5' }: { crop: Crop; className?: string }) {
  const Glyph = GLYPHS[crop]
  return <Glyph className={className} />
}

/**
 * The altitude belt as a landscape: flat valley, rolling midland, high peaks.
 *
 * Each scene keeps the same sky/ground structure so the three read as one set, and the
 * silhouette alone distinguishes them — colour is never the only difference.
 */
export function BeltScene({ zone, className = 'size-12' }: { zone: AgroZone; className?: string }) {
  const sky = {
    Lowland: ['oklch(0.86 0.09 78)', 'oklch(0.93 0.05 92)'],
    Midland: ['oklch(0.84 0.08 150)', 'oklch(0.93 0.05 140)'],
    Highland: ['oklch(0.82 0.07 235)', 'oklch(0.93 0.04 230)'],
  }[zone]
  const ground = {
    Lowland: 'oklch(0.72 0.12 85)',
    Midland: 'oklch(0.58 0.12 150)',
    Highland: 'oklch(0.52 0.06 235)',
  }[zone]
  const id = `belt-${zone}`

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="100%" stopColor={sky[1]} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="24" cy="24" r="23" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="48" height="48" fill={`url(#${id}-sky)`} />
        <circle cx="35" cy="14" r="5" fill="oklch(0.9 0.14 92)" opacity=".85" />
        {zone === 'Lowland' && (
          <>
            <path d="M0 32h48v16H0z" fill={ground} />
            <path d="M0 32c8-2 14 2 22 0s18-3 26-1v2H0Z" fill="oklch(0.66 0.11 80)" />
            <g stroke="oklch(0.42 0.07 80)" strokeWidth="1.4" strokeLinecap="round">
              <path d="M10 44v-6M18 45v-7M26 44v-6M34 45v-7M42 44v-6" />
            </g>
          </>
        )}
        {zone === 'Midland' && (
          <>
            <path d="M0 30c8-8 14 2 24-4s16 2 24 6v16H0Z" fill={ground} />
            <path d="M0 38c10-6 16 4 26-2s14 2 22 4v8H0Z" fill="oklch(0.68 0.13 145)" />
            <g fill="oklch(0.38 0.08 150)">
              <ellipse cx="12" cy="36" rx="3" ry="4" />
              <ellipse cx="33" cy="33" rx="2.4" ry="3.2" />
            </g>
          </>
        )}
        {zone === 'Highland' && (
          <>
            <path d="M0 40 14 18l10 13 8-11 16 20v8H0Z" fill={ground} />
            <path d="M14 18l5 6.5h-10ZM32 20l4.5 5.5h-9Z" fill="oklch(0.97 0.01 240)" />
            <path d="M0 44c10-4 18 2 26-1s14 0 22 3v4H0Z" fill="oklch(0.42 0.06 235)" />
          </>
        )}
      </g>
      <circle cx="24" cy="24" r="23" fill="none" stroke="var(--border)" strokeWidth="1.5" />
    </svg>
  )
}
