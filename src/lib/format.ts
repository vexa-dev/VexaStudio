import type { Currency } from '@/domain/types'

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
