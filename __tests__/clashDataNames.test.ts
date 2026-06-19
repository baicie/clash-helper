import {
  formatClashDataId,
  getClashDataMeta,
  getClashDataName,
} from '../src/clash/clashDataNames'

describe('clashDataNames', () => {
  it('resolves known home village building names', () => {
    expect(getClashDataName(1000001)).toBe('大本营')
    expect(getClashDataName(1000006)).toBe('训练营')
  })

  it('resolves known spell names', () => {
    expect(getClashDataName(26000010)).toBe('地震法术')
  })

  it('resolves known builder troop names', () => {
    expect(getClashDataName(4000037)).toBe('加农炮战车')
  })

  it('returns meta', () => {
    expect(getClashDataMeta(1000001)).toMatchObject({
      en: 'Town Hall',
      zh: '大本营',
      kind: 'building',
    })
  })

  it('formats unknown ids with fallback', () => {
    expect(formatClashDataId(123456789)).toBe('#123456789')
    expect(formatClashDataId(undefined)).toBe('未知 ID')
  })
})
