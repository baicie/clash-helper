import type { VillageRecord, VillageTimer } from '../src/types'

import { buildSystemAlarmUpdatePlan } from '../src/system/alarmReconciliation'

function createTimer(id: string, endAt: number): VillageTimer {
  return {
    id,
    villageId: '#TEST',
    sourceGroup: 'buildings',
    scope: 'home',
    title: id,
    remainingSeconds: 60,
    sourceTimestamp: 1,
    endAt,
  }
}

function createVillage(timers: VillageTimer[]): VillageRecord {
  return {
    id: '#TEST',
    tag: '#TEST',
    name: '测试村庄',
    sourceTimestamp: 1,
    createdAt: 1,
    updatedAt: 1,
    importedAt: 1,
    notificationMode: 'alarm',
    systemAlarmSyncEnabled: true,
    timers,
  }
}

describe('alarmReconciliation', () => {
  it('keeps unchanged alarms, dismisses removed alarms and creates new ones', () => {
    const unchanged = {
      ...createTimer('unchanged', new Date(2026, 0, 1, 12).getTime()),
      systemAlarmId: 'alarm-unchanged',
    }
    const removed = {
      ...createTimer('removed', new Date(2026, 0, 1, 13).getTime()),
      systemAlarmId: 'alarm-removed',
    }
    const added = createTimer('added', new Date(2026, 0, 1, 14).getTime())
    const plan = buildSystemAlarmUpdatePlan({
      existing: createVillage([unchanged, removed]),
      updated: createVillage([unchanged, added]),
      now: new Date(2026, 0, 1, 11).getTime(),
      quietHours: { enabled: true, startHour: 22, endHour: 10 },
    })

    expect(plan.alarmsToDismiss.map((timer) => timer.id)).toEqual(['removed'])
    expect(plan.alarmsToCreate.map((timer) => timer.id)).toEqual(['added'])
  })

  it('skips new alarms in quiet hours', () => {
    const added = createTimer('night', new Date(2026, 0, 1, 23).getTime())
    const plan = buildSystemAlarmUpdatePlan({
      existing: createVillage([]),
      updated: createVillage([added]),
      now: new Date(2026, 0, 1, 21).getTime(),
      quietHours: { enabled: true, startHour: 22, endHour: 10 },
    })

    expect(plan.alarmsToCreate).toEqual([])
    expect(plan.quietHoursSkipped).toBe(1)
  })

  it('migrates villages that have alarm ids but no sync flag', () => {
    const existingAlarm = {
      ...createTimer('old', new Date(2026, 0, 1, 12).getTime()),
      systemAlarmId: 'alarm-old',
    }
    const existing = createVillage([existingAlarm])
    existing.systemAlarmSyncEnabled = undefined
    const added = createTimer('new', new Date(2026, 0, 1, 13).getTime())

    const plan = buildSystemAlarmUpdatePlan({
      existing,
      updated: createVillage([existingAlarm, added]),
      now: new Date(2026, 0, 1, 11).getTime(),
      quietHours: { enabled: false, startHour: 22, endHour: 10 },
    })

    expect(plan.alarmsToCreate.map((timer) => timer.id)).toEqual(['new'])
  })

  it('dismisses a retained alarm when it falls in quiet hours', () => {
    const nightAlarm = {
      ...createTimer('night', new Date(2026, 0, 1, 23).getTime()),
      systemAlarmId: 'alarm-night',
    }
    const plan = buildSystemAlarmUpdatePlan({
      existing: createVillage([nightAlarm]),
      updated: createVillage([nightAlarm]),
      now: new Date(2026, 0, 1, 21).getTime(),
      quietHours: { enabled: true, startHour: 22, endHour: 10 },
    })

    expect(plan.alarmsToDismiss.map((timer) => timer.id)).toEqual(['night'])
    expect(plan.alarmsToCreate).toEqual([])
    expect(plan.quietHoursSkipped).toBe(1)
  })
})
