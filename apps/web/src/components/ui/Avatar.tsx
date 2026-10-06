import { useState } from 'react'
import { cn, initials } from '@/lib/utils'

const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }

interface AvatarProps {
  name: string
  size?: keyof typeof sizes
  className?: string
  /** Optional photo (URL or data URL); initials are the fallback. */
  src?: string | null
}

export function Avatar({ name, size = 'md', className, src }: AvatarProps) {
  // Remember which source failed instead of resetting a flag in an effect: a new `src` is retried automatically.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = failedSrc === src
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-display font-semibold text-primary-text',
        sizes[size],
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full rounded-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}
