import type { QuietHoursSettings } from '../settings/quietHours'
import type { VillageRecord, VillageTimer } from '../types'

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
  const updatedTimersById = new Map(
    params.updated.timers.map((timer) => [timer.id, timer]),
  )
  const alarmsToDismiss = params.existing.timers.filter((timer) => {
    if (!timer.systemAlarmId) {
      return false
    }

    const updatedTimer = updatedTimersById.get(timer.id)

    return (
      !updatedTimer ||
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

  const dismissedTimerIds = new Set(alarmsToDismiss.map((timer) => timer.id))
  const missingActiveAlarms = params.updated.timers.filter((timer) => {
    const hasRetainedAlarm =
      timer.systemAlarmId && !dismissedTimerIds.has(timer.id)

    return !hasRetainedAlarm && timer.endAt > now
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
