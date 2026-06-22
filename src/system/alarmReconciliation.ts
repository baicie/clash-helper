import type { QuietHoursSettings } from '../settings/quietHours'
import type {
  PendingSystemAlarmCleanup,
  VillageRecord,
  VillageTimer,
} from '../types'

import { isInQuietHours } from '../settings/quietHours'

export interface AlarmUpdatePlan {
  alarmsToCreate: VillageTimer[]
  alarmsToDismiss: VillageTimer[]
  quietHoursSkipped: number
}

export function buildSystemAlarmUpdatePlan(params: {
  existing: VillageRecord
  updated: VillageRecord
  now?: number
  quietHours: QuietHoursSettings
}): AlarmUpdatePlan {
  const now = params.now ?? Date.now()
  const updatedTimersByStableKey = new Map(
    params.updated.timers.map((timer) => [timer.stableKey, timer]),
  )
  const alarmsToDismiss = params.existing.timers.filter((timer) => {
    if (!timer.systemAlarmId) {
      return false
    }

    const updatedTimer = updatedTimersByStableKey.get(timer.stableKey)

    return (
      !updatedTimer ||
      updatedTimer.endAt !== timer.endAt ||
      updatedTimer.title !== timer.title ||
      (updatedTimer.endAt > now &&
        isInQuietHours(updatedTimer.endAt, params.quietHours))
    )
  })

  const syncEnabled =
    params.existing.systemAlarmSyncEnabled ??
    params.existing.timers.some((timer) => Boolean(timer.systemAlarmId))

  if (!syncEnabled) {
    return {
      alarmsToCreate: [],
      alarmsToDismiss,
      quietHoursSkipped: 0,
    }
  }

  const dismissedAlarmIds = new Set(alarmsToDismiss.map((timer) => timer.id))
  const retainedStableKeysWithAlarm = new Set(
    params.existing.timers
      .filter(
        (timer) => timer.systemAlarmId && !dismissedAlarmIds.has(timer.id),
      )
      .map((t) => t.stableKey),
  )
  const missingActiveAlarms = params.updated.timers.filter((timer) => {
    if (timer.endAt <= now) {
      return false
    }
    if (timer.systemAlarmId) {
      return false
    }
    if (retainedStableKeysWithAlarm.has(timer.stableKey)) {
      return false
    }
    return true
  })
  const alarmsToCreate = missingActiveAlarms.filter(
    (timer) => !isInQuietHours(timer.endAt, params.quietHours),
  )

  return {
    alarmsToCreate,
    alarmsToDismiss,
    quietHoursSkipped: missingActiveAlarms.length - alarmsToCreate.length,
  }
}

export function stageSystemAlarmUpdate(params: {
  existing: VillageRecord
  updated: VillageRecord
  now?: number
  quietHours: QuietHoursSettings
}) {
  const plan = buildSystemAlarmUpdatePlan(params)
  const pendingByKey = new Map<string, PendingSystemAlarmCleanup>()

  for (const pending of params.existing.pendingSystemAlarmCleanup ?? []) {
    pendingByKey.set(pending.key, pending)
  }

  for (const timer of plan.alarmsToDismiss) {
    const pending = {
      key: `${timer.endAt}:${timer.title}`,
      title: timer.title,
      endAt: timer.endAt,
    }
    pendingByKey.set(pending.key, pending)
  }

  const pendingSystemAlarmCleanup = [...pendingByKey.values()]

  return {
    plan,
    village: {
      ...params.updated,
      pendingSystemAlarmCleanup:
        pendingSystemAlarmCleanup.length > 0
          ? pendingSystemAlarmCleanup
          : undefined,
    },
  }
}
