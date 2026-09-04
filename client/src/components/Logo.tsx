import { useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * The brand mark.
 *
 * The image files live in `public/brand/`. Until they are there — or if one
 * fails to load — the name is set in type instead, so a missing file shows a
 * wordmark rather than a broken image. Dropping the real files in at those
 * paths replaces this everywhere, with no code change.
 */

type Variant = 'full' | 'mark'
/** `light` is the version drawn on the dark sidebar; `dark` is for paper. */
type Tone = 'light' | 'dark'

const SOURCES: Record<Variant, Record<Tone, string>> = {
  full: { dark: '/brand/logo.svg', light: '/brand/logo-light.svg' },
  mark: { dark: '/brand/mark.svg', light: '/brand/mark-light.svg' },
}

export const BRAND_NAME = 'פרלשטיין'
export const BRAND_SUFFIX = 'משכנתאות'

export function Logo({
  variant = 'full',
  tone = 'dark',
  className,
  height = 32,
}: {
  variant?: Variant
  tone?: Tone
  className?: string
  /** Rendered height in pixels; the width follows the artwork. */
  height?: number
}) {
  const [missing, setMissing] = useState(false)

  if (!missing) {
    return (
      <img
        src={SOURCES[variant][tone]}
        alt={`${BRAND_NAME} ${BRAND_SUFFIX}`}
        style={{ height }}
        className={cn('w-auto object-contain', className)}
        onError={() => setMissing(true)}
      />
    )
  }

  if (variant === 'mark') {
    return (
      <span
        aria-label={BRAND_NAME}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md font-heading font-bold',
          tone === 'light' ? 'bg-gold text-steel-900' : 'bg-steel-700 text-white',
          className,
        )}
        style={{ height, width: height, fontSize: height * 0.5 }}
      >
        פ
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex items-baseline gap-1.5 font-heading leading-none',
        tone === 'light' ? 'text-white' : 'text-steel-700',
        className,
      )}
      style={{ fontSize: height * 0.62 }}
    >
      <span className="font-bold">{BRAND_NAME}</span>
      <span className={cn('font-medium', tone === 'light' ? 'text-gold' : 'text-gold-ink')}>
        {BRAND_SUFFIX}
      </span>
    </span>
  )
}
