import * as React from 'react'
import { cn } from '#/lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'icon'
}

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors outline-none disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-neutral-900 text-white hover:bg-neutral-700',
        variant === 'outline' && 'border bg-white hover:bg-neutral-50',
        variant === 'ghost' && 'hover:bg-neutral-100',
        size === 'default' && 'h-9 px-4',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'icon' && 'size-9',
        className,
      )}
      {...props}
    />
  )
}
