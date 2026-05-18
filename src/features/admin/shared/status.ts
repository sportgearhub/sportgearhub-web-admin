export function getOperationalStatusVariant(status: string) {
  const normalized = status.toLowerCase()

  if (normalized.includes('active') || normalized.includes('ready') || normalized.includes('approved')) {
    return 'success'
  }

  if (normalized.includes('hold') || normalized.includes('review') || normalized.includes('pending')) {
    return 'warning'
  }

  if (normalized.includes('blocked') || normalized.includes('rejected') || normalized.includes('error')) {
    return 'destructive'
  }

  return 'info'
}
