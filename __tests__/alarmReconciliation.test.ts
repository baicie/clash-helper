import type { VillageRecord, VillageTimer } from '../src/types'

import {
  buildSystemAlarmUpdatePlan,
  stageSystemAlarmUpdate,
} from '../src/system/alarmReconciliation'

function createTimer(params: {
  id: string
  endAt: number
  sourceGroup?: VillageTimer['sourceGroup']
  dataId?: number
  level?: number
}): VillageTimer {
  return {
    stableKey: `${params.id}:stable`,
    id: params.id,
    villageId: '#TEST',
    sourceGroup: params.sourceGroup ?? 'buildings',
    scope: 'home',
    title: params.id,
    dataId: params.dataId,
    level: params.level,
    remainingSeconds: 60,
    sourceTimestamp: 1,
    endAt: params.endAt,
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
      ...createTimer({
        id: 'unchanged',
        endAt: new Date(2026, 0, 1, 12).getTime(),
      }),
      systemAlarmId: 'alarm-unchanged',
    }
    const removed = {
      ...createTimer({
        id: 'removed',
        endAt: new Date(2026, 0, 1, 13).getTime(),
      }),
      systemAlarmId: 'alarm-removed',
    }
    const added = createTimer({
      id: 'added',
      endAt: new Date(2026, 0, 1, 14).getTime(),
    })
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
    const added = createTimer({
      id: 'night',
      endAt: new Date(2026, 0, 1, 23).getTime(),
    })
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
      ...createTimer({ id: 'old', endAt: new Date(2026, 0, 1, 12).getTime() }),
      systemAlarmId: 'alarm-old',
    }
    const existing = createVillage([existingAlarm])
    existing.systemAlarmSyncEnabled = undefined
    const added = createTimer({
      id: 'new',
      endAt: new Date(2026, 0, 1, 13).getTime(),
    })

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
      ...createTimer({
        id: 'night',
        endAt: new Date(2026, 0, 1, 23).getTime(),
      }),
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
    // The timer already had an alarm — it is dismissed, not skipped from creation.
    expect(plan.quietHoursSkipped).toBe(0)
  })

  it('replaces an alarm when the same project completion time changes', () => {
    const existingTimer = {
      ...createTimer({
        id: 'upgrade-old',
        endAt: new Date(2026, 0, 1, 12).getTime(),
      }),
      systemAlarmId: 'alarm-old',
    }
    const updatedTimer = {
      ...createTimer({
        id: 'upgrade-new',
        endAt: new Date(2026, 0, 1, 13).getTime(),
      }),
      stableKey: existingTimer.stableKey,
    }
    const plan = buildSystemAlarmUpdatePlan({
      existing: createVillage([existingTimer]),
      updated: createVillage([updatedTimer]),
      now: new Date(2026, 0, 1, 11).getTime(),
      quietHours: { enabled: false, startHour: 22, endHour: 10 },
    })

    expect(plan.alarmsToDismiss).toEqual([existingTimer])
    expect(plan.alarmsToCreate).toEqual([updatedTimer])
  })

  it('replaces an expired alarm when the same project becomes active again', () => {
    const existingTimer = {
      ...createTimer({
        id: 'expired-upgrade',
        endAt: new Date(2026, 0, 1, 10).getTime(),
      }),
      systemAlarmId: 'alarm-expired',
    }
    const updatedTimer = {
      ...createTimer({
        id: 'active-upgrade',
        endAt: new Date(2026, 0, 1, 13).getTime(),
      }),
      stableKey: existingTimer.stableKey,
    }
    const plan = buildSystemAlarmUpdatePlan({
      existing: createVillage([existingTimer]),
      updated: createVillage([updatedTimer]),
      now: new Date(2026, 0, 1, 11).getTime(),
      quietHours: { enabled: false, startHour: 22, endHour: 10 },
    })

    expect(plan.alarmsToDismiss).toEqual([existingTimer])
    expect(plan.alarmsToCreate).toEqual([updatedTimer])
  })

  it('persists stale alarms until an explicit system sync', () => {
    const existingTimer = {
      ...createTimer({ id: 'old', endAt: 10_000 }),
      systemAlarmId: 'alarm-old',
    }
    const updatedTimer = {
      ...createTimer({ id: 'new', endAt: 20_000 }),
      stableKey: existingTimer.stableKey,
    }
    const staged = stageSystemAlarmUpdate({
      existing: createVillage([existingTimer]),
      updated: createVillage([updatedTimer]),
      now: 15_000,
      quietHours: { enabled: false, startHour: 22, endHour: 10 },
    })

    expect(staged.village.pendingSystemAlarmCleanup).toEqual([
      {
        key: '10000:old',
        title: 'old',
        endAt: 10_000,
      },
    ])
    expect(staged.plan.alarmsToCreate).toEqual([updatedTimer])
  })

  it('replaces an alarm when a legacy numbered title is cleaned up', () => {
    const existingTimer = {
      ...createTimer({
        id: 'builder-upgrade',
        endAt: new Date(2026, 0, 1, 12).getTime(),
      }),
      title: '夜世界建筑 · 双管加农炮 Lv.5',
      systemAlarmId: 'alarm-numbered-title',
    }
    const updatedTimer = {
      ...existingTimer,
      title: '夜世界建筑 · 双管加农炮',
      systemAlarmId: undefined,
    }
    const plan = buildSystemAlarmUpdatePlan({
      existing: createVillage([existingTimer]),
      updated: createVillage([updatedTimer]),
      now: new Date(2026, 0, 1, 11).getTime(),
      quietHours: { enabled: false, startHour: 22, endHour: 10 },
    })

    expect(plan.alarmsToDismiss).toEqual([existingTimer])
    expect(plan.alarmsToCreate).toEqual([updatedTimer])
  })
})
