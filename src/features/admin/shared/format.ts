/** Roubles — the amounts on payment detail, settlement and ledger are already in roubles. */
export function formatRubles(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

/** Kopecks — the refund and payment-status endpoints speak the acquirer's minor units. */
export function formatKopecks(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return formatRubles(value / 100)
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
