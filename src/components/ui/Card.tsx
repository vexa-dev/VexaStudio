import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'raised' | 'accent'

const tones: Record<Tone, string> = {
  default: 'border-border bg-surface',
  raised: 'border-border bg-surface shadow-card',
  accent: 'border-primary/30 bg-primary-soft',
}

export function Card({ tone = 'default', className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cn('rounded-xl border p-4 sm:p-5', tones[tone], className)} {...props} />
}
