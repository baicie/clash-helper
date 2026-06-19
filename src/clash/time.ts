export function normalizeTimestampSeconds(
  timestamp: number | undefined,
  fallbackMs = Date.now(),
) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return Math.floor(fallbackMs / 1000)
  }

  // 兼容秒级 / 毫秒级时间戳。
  if (timestamp > 10_000_000_000) {
    return Math.floor(timestamp / 1000)
  }

  return Math.floor(timestamp)
}

export function secondsToMs(seconds: number) {
  return Math.floor(seconds) * 1000
}

export function formatDuration(ms: number) {
  if (ms <= 0) {
    return '已完成'
  }

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`
  }

  if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`
  }

  if (minutes > 0) {
    return `${minutes}分钟 ${seconds}秒`
  }

  return `${seconds}秒`
}

export function formatDateTime(timestampMs: number) {
  return new Date(timestampMs).toLocaleString()
}
