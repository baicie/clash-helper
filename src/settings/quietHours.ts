export interface QuietHoursSettings {
  enabled: boolean
  startHour: number
  endHour: number
}

export function normalizeHour(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(23, Math.max(0, Math.floor(value)))
}

export function isInQuietHours(
  timestamp: number,
  settings: QuietHoursSettings,
) {
  if (!settings.enabled) {
    return false
  }

  const hour = new Date(timestamp).getHours()
  const { startHour, endHour } = settings

  if (startHour === endHour) {
    return true
  }

  if (startHour < endHour) {
    return hour >= startHour && hour < endHour
  }

  return hour >= startHour || hour < endHour
}
