// Adapted from NadheWedd src/components/ui/Button.tsx: same look, larger touch
// targets (56 px) because visitors use it one-handed while posing.
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'solid' | 'outline' | 'light' | 'ghost-light'

const base =
  'inline-flex items-center justify-center font-medium whitespace-nowrap uppercase transition-[background-color,color,border-color,transform,opacity] duration-300 ease-(--ease-soft) active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50'

const sizes = {
  normal: 'min-h-14 rounded-full gap-2.5 px-6 py-3 text-[0.8rem] tracking-[0.16em]',
  /** Icon above a short label, for 2–3 buttons side by side on narrow phones. */
  compact: 'min-h-16 rounded-2xl flex-col gap-1 px-2 py-2 text-[0.68rem] tracking-[0.12em]',
}

const variants: Record<Variant, string> = {
  solid: 'bg-maroon text-ivory shadow-[0_10px_24px_-14px_rgb(94_20_20/0.9)] hover:bg-maroon-deep',
  outline: 'border border-maroon/40 bg-ivory/60 text-maroon hover:border-maroon hover:bg-maroon/5',
  light: 'bg-ivory text-maroon-deep hover:bg-white',
  'ghost-light': 'border border-ivory/40 text-ivory hover:border-ivory hover:bg-ivory/10',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  compact?: boolean
  children: ReactNode
}

export function Button({ variant = 'solid', icon, compact = false, children, className = '', ...rest }: Props) {
  return (
    <button type="button" className={`${base} ${sizes[compact ? 'compact' : 'normal']} ${variants[variant]} ${className}`} {...rest}>
      {icon && <span className="flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
