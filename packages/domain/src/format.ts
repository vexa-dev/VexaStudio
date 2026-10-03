import type { Currency } from './types'

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Monto en soles: `S/ 1,234.50`. */
export function formatPen(amount: number): string {
  return `S/ ${numberFormat.format(amount)}`
}

/** Monto según moneda: `S/ 1,234.50` o `US$ 13.00`. */
export function formatMoney(amount: number, currency: Currency): string {
  return currency === 'PEN' ? formatPen(amount) : `US$ ${numberFormat.format(amount)}`
}

/** Horas con hasta 2 decimales: `1.5 h`. */
export function formatHours(hours: number): string {
  return `${Number(hours.toFixed(2))} h`
}

/** Fracción como porcentaje: `0.8` → `80 %`. */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)} %`
}

const integerFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Entero con separador de miles: `1,234`. */
export function formatInt(value: number): string {
  return integerFormat.format(Math.round(value))
}

/** Duración en reloj: `1:05:09` (horas sin ceros a la izquierda). */
export function formatClock(ms: number): string {
  const total = Math.max(Math.floor(ms / 1000), 0)
  const hours = Math.floor(total / 3600)
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}
