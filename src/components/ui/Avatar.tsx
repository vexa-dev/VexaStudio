import { cn, initials } from '@/lib/utils'

const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }

export function Avatar({ name, size = 'md', className }: { name: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-display font-semibold text-primary-text',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
