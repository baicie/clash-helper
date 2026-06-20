import {
  createVillageFromExport,
  getActiveTimers,
  getDoneTimers,
  getNextActiveTimer,
  parseClashVillageExportText,
  parseTimersFromExport,
} from '../src/clash/parseClashExport'

const sample = {
  tag: '#R2J0CRJYR',
  timestamp: 1781860781,
  helpers: [{ data: 93000001, lvl: 1, helper_cooldown: 8426 }],
  buildings: [
    { data: 1000001, lvl: 9, timer: 88982 },
    { data: 1000006, lvl: 10, timer: 111356 },
    { data: 1000000, lvl: 2, cnt: 1 },
  ],
  spells: [
    {
      data: 26000010,
      lvl: 2,
      timer: 8163,
      helper_recurrent: true,
    },
  ],
  buildings2: [
    { data: 1000038, lvl: 5, timer: 70029 },
    { data: 1000036, lvl: 5, timer: 77663 },
  ],
  units2: [{ data: 4000037, lvl: 8, timer: 13990 }],
  boosts: {
    clocktower_cooldown: 53156,
  },
}

describe('parseClashExport', () => {
  it('parses json text', () => {
    const exported = parseClashVillageExportText(JSON.stringify(sample))

    expect(exported.tag).toBe('#R2J0CRJYR')
    expect(exported.timestamp).toBe(1781860781)
  })

  it('throws when json text is invalid', () => {
    expect(() => parseClashVillageExportText('{')).toThrow('JSON 格式不正确')
  })

  it('parses timers from all supported groups', () => {
    const timers = parseTimersFromExport(sample, '#R2J0CRJYR', 1781860781000)

    expect(timers).toHaveLength(8)

    expect(timers[0]).toMatchObject({
      villageId: '#R2J0CRJYR',
      sourceGroup: 'spells',
      scope: 'home',
      dataId: 26000010,
      level: 2,
      remainingSeconds: 8163,
      endAt: (1781860781 + 8163) * 1000,
    })

    expect(timers.some((timer) => timer.title === '夜世界钟楼冷却')).toBe(true)

    expect(timers.some((timer) => timer.sourceGroup === 'helpers')).toBe(true)
  })

  it('creates village record from export', () => {
    const village = createVillageFromExport(sample, {
      notificationMode: 'alarm',
      importedAt: 1781860781000,
    })

    expect(village.id).toBe('#R2J0CRJYR')
    expect(village.tag).toBe('#R2J0CRJYR')
    expect(village.name).toBe('#R2J0CRJYR')
    expect(village.notificationMode).toBe('alarm')
    expect(village.timers).toHaveLength(8)
  })

  it('preserves existing village name and notification mode', () => {
    const existing = createVillageFromExport(sample, {
      notificationMode: 'notification',
      importedAt: 1781860781000,
    })

    const updated = createVillageFromExport(sample, {
      existing: {
        ...existing,
        name: '我的大号',
        notificationMode: 'off',
      },
      notificationMode: 'alarm',
      importedAt: 1781860782000,
    })

    expect(updated.name).toBe('我的大号')
    expect(updated.notificationMode).toBe('off')
  })

  it('preserves system alarm metadata for unchanged timers', () => {
    const existing = createVillageFromExport(sample, {
      importedAt: 1781860781000,
    })
    existing.systemAlarmSyncEnabled = true
    existing.timers[0].systemAlarmId = 'alarm-existing'
    existing.timers[0].systemTimerId = 'timer-existing'

    const updated = createVillageFromExport(sample, {
      existing,
      importedAt: 1781860782000,
    })

    expect(updated.systemAlarmSyncEnabled).toBe(true)
    expect(updated.timers[0].systemAlarmId).toBe('alarm-existing')
    expect(updated.timers[0].systemTimerId).toBe('timer-existing')
  })

  it('splits active and done timers', () => {
    const village = createVillageFromExport(sample, {
      importedAt: 1781860781000,
    })

    const nowBeforeAllDone = (1781860781 + 1) * 1000
    const nowAfterFirstDone = (1781860781 + 9000) * 1000

    expect(getActiveTimers(village, nowBeforeAllDone)).toHaveLength(8)
    expect(getDoneTimers(village, nowBeforeAllDone)).toHaveLength(0)

    expect(getDoneTimers(village, nowAfterFirstDone).length).toBeGreaterThan(0)
    expect(getActiveTimers(village, nowAfterFirstDone).length).toBeLessThan(8)
  })

  it('uses a stable, project-name-shaped title so it can double as the alarm label', () => {
    const timers = parseTimersFromExport(sample, '#R2J0CRJYR', 1781860781000)

    const building = timers.find(
      (timer) => timer.sourceGroup === 'buildings' && timer.dataId === 1000006,
    )

    // timer.title is what the app shows in the village list AND what we
    // forward to the system clock as the alarm label, so they must match.
    // Internal IDs are intentionally kept off the title (still available on
    // VillageTimer.dataId) so the system clock app — which truncates long
    // labels — stays readable.
    expect(building?.title).toBe('主世界建筑 · 训练营 Lv.10')

    const helper = timers.find((timer) => timer.sourceGroup === 'helpers')
    expect(helper?.title).toBe('助手冷却 · 助手')
  })

  it('falls back to #<id> when the clash data id is unknown', () => {
    const timers = parseTimersFromExport(
      {
        ...sample,
        buildings: [{ data: 999999999, lvl: 3, timer: 600 }],
      },
      '#R2J0CRJYR',
      1781860781000,
    )

    const unknown = timers.find(
      (timer) =>
        timer.sourceGroup === 'buildings' && timer.dataId === 999999999,
    )

    expect(unknown?.title).toBe('主世界建筑 · #999999999 Lv.3')
  })

  it('advances continuous countdown to the next nearest timer', () => {
    const village = createVillageFromExport(sample, {
      importedAt: 1781860781000,
    })
    const timersByEndAt = [...village.timers].sort(
      (left, right) => left.endAt - right.endAt,
    )
    const first = timersByEndAt[0]
    const second = timersByEndAt[1]

    expect(getNextActiveTimer(village, first.endAt - 1)?.id).toBe(first.id)
    expect(getNextActiveTimer(village, first.endAt)?.id).toBe(second.id)
  })
})
