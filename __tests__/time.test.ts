import {
  formatDuration,
  normalizeTimestampSeconds,
  secondsToMs,
} from '../src/clash/time'

describe('time utilities', () => {
  it('normalizes seconds timestamp', () => {
    expect(normalizeTimestampSeconds(1781860781)).toBe(1781860781)
  })

  it('normalizes milliseconds timestamp', () => {
    expect(normalizeTimestampSeconds(1781860781000)).toBe(1781860781)
  })

  it('falls back when timestamp is invalid', () => {
    expect(normalizeTimestampSeconds(undefined, 1781860781000)).toBe(1781860781)
  })

  it('converts seconds to ms', () => {
    expect(secondsToMs(10)).toBe(10000)
  })

  it('formats duration', () => {
    expect(formatDuration(8163 * 1000)).toBe('2小时 16分钟')
    expect(formatDuration(61 * 1000)).toBe('1分钟 1秒')
    expect(formatDuration(0)).toBe('已完成')
  })
})
