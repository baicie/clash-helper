import { isInQuietHours, normalizeHour } from '../src/settings/quietHours'

describe('quietHours', () => {
  const settings = {
    enabled: true,
    startHour: 22,
    endHour: 10,
  }

  it('recognizes a quiet range that crosses midnight', () => {
    expect(
      isInQuietHours(new Date(2026, 0, 1, 21, 59).getTime(), settings),
    ).toBe(false)
    expect(isInQuietHours(new Date(2026, 0, 1, 22).getTime(), settings)).toBe(
      true,
    )
    expect(
      isInQuietHours(new Date(2026, 0, 2, 9, 59).getTime(), settings),
    ).toBe(true)
    expect(isInQuietHours(new Date(2026, 0, 2, 10).getTime(), settings)).toBe(
      false,
    )
  })

  it('does not skip alarms when disabled', () => {
    expect(
      isInQuietHours(new Date(2026, 0, 1, 23).getTime(), {
        ...settings,
        enabled: false,
      }),
    ).toBe(false)
  })

  it('normalizes editable hour values', () => {
    expect(normalizeHour(-1, 22)).toBe(0)
    expect(normalizeHour(30, 10)).toBe(23)
    expect(normalizeHour(Number.NaN, 10)).toBe(10)
  })
})
