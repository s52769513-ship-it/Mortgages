import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger'
type Size = 'sm' | 'md'

/** One primary action per screen — it is the only fully filled object on it. */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-steel-600 text-white shadow-button hover:bg-steel-700 active:bg-steel-800',
  secondary: 'border border-field text-ink hover:bg-ink/[0.04] active:bg-ink/[0.06]',
  tertiary:
    'text-steel-700 underline underline-offset-[3px] hover:text-steel-800 hover:decoration-2',
  danger: 'bg-urgent text-white shadow-button hover:brightness-110 active:brightness-95',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-md',
  // 44px touch target on mobile, 36px on desktop.
  md: 'h-11 md:h-9 px-4 text-[14px] gap-2 rounded-md',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Shown in place of the label while loading; the width does not change. */
  loadingLabel?: string
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingLabel = 'שומר…',
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-colors duration-micro ease-standard',
        'disabled:pointer-events-none disabled:opacity-45',
        variant === 'tertiary' ? 'h-auto p-0 text-[14px]' : SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <span
            className="size-[18px] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-85"
            aria-hidden
          />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  )
})
