import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

const CONTROL = cn(
  'w-full rounded-md border border-field bg-surface px-3 text-[15px] text-ink',
  'placeholder:text-ink-subtle',
  'transition-colors duration-micro ease-standard',
  'focus:border-steel-600',
  'disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-subtle',
  'aria-[invalid=true]:border-urgent',
)

/**
 * Label sits above the control and is always present — a placeholder is never
 * the label. An error shows as text under the field, not just a red border.
 */
function Wrapper({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  htmlFor: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={htmlFor}
          className={cn(
            'block text-[12px] font-semibold',
            error ? 'text-urgent' : 'text-ink-muted',
          )}
        >
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[12px] text-urgent-ink">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

type Common = { label?: ReactNode; hint?: ReactNode; error?: ReactNode }

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common>(
  function Input({ label, hint, error, className, id, required, ...rest }, ref) {
    const auto = useId()
    const fieldId = id ?? auto
    return (
      <Wrapper label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn(CONTROL, 'h-11 md:h-10', className)}
          {...rest}
        />
      </Wrapper>
    )
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & Common
>(function Textarea({ label, hint, error, className, id, required, rows = 3, ...rest }, ref) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <Wrapper label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(CONTROL, 'resize-y py-2.5 leading-relaxed', className)}
        {...rest}
      />
    </Wrapper>
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> &
    Common & { options: { value: string; label: string }[]; placeholder?: string }
>(function Select(
  { label, hint, error, className, id, required, options, placeholder, ...rest },
  ref,
) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <Wrapper label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(CONTROL, 'h-11 cursor-pointer md:h-10', className)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  )
})

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer select-none items-center gap-2.5 text-[15px]', className)}
    >
      <input
        id={id}
        type="checkbox"
        className="size-4 cursor-pointer rounded-sm border-field text-steel-600"
        {...rest}
      />
      {label}
    </label>
  )
}

/** Three-way choice rendered inline — priority, scope filters, and the like. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label?: string
  className?: string
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      {label && (
        <span id={id} className="block text-[12px] font-semibold text-ink-muted">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={label ? id : undefined}
        className={cn('flex overflow-hidden rounded-md border border-field', className)}
      >
        {options.map((o, i) => {
          const selected = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex-1 px-3 py-2 text-[13.5px] font-medium',
                'transition-colors duration-micro ease-standard',
                i > 0 && 'border-e border-field',
                selected
                  ? 'bg-steel-600 text-white shadow-button'
                  : 'text-ink-muted hover:bg-ink/[0.04]',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
