export type NotificationMode = 'alarm' | 'countdown' | 'notification' | 'off'

export interface AppSettings {
  defaultNotificationMode: NotificationMode
  defaultReminderLeadMinutes: number
  quietHoursEnabled: boolean
  quietHoursStart: number
  quietHoursEnd: number
}

export type VillageScope = 'home' | 'builder' | 'system'

export type TimerSourceGroup =
  | 'buildings'
  | 'traps'
  | 'units'
  | 'siege_machines'
  | 'heroes'
  | 'spells'
  | 'pets'
  | 'equipment'
  | 'buildings2'
  | 'traps2'
  | 'units2'
  | 'heroes2'
  | 'helpers'
  | 'boosts'

export interface ClashExportItem {
  data?: number
  lvl?: number
  timer?: number
  cnt?: number
  helper_cooldown?: number
  helper_recurrent?: boolean
}

export interface ClashVillageExport {
  tag?: string
  timestamp?: number

  helpers?: ClashExportItem[]

  buildings?: ClashExportItem[]
  traps?: ClashExportItem[]
  decos?: ClashExportItem[]
  obstacles?: ClashExportItem[]
  units?: ClashExportItem[]
  siege_machines?: ClashExportItem[]
  heroes?: ClashExportItem[]
  spells?: ClashExportItem[]
  pets?: ClashExportItem[]
  equipment?: ClashExportItem[]

  buildings2?: ClashExportItem[]
  traps2?: ClashExportItem[]
  decos2?: ClashExportItem[]
  obstacles2?: ClashExportItem[]
  units2?: ClashExportItem[]
  heroes2?: ClashExportItem[]

  boosts?: {
    clocktower_cooldown?: number
  }

  [key: string]: unknown
}

export interface VillageTimer {
  /**
   * Stable across re-imports: (sourceGroup, dataId, level). Changes only when the
   * item type or level changes (e.g. upgrade from level 10 → 11). Used by alarm
   * reconciliation to match timers across village updates.
   */
  stableKey: string

  id: string
  villageId: string
  sourceGroup: TimerSourceGroup
  scope: VillageScope

  title: string
  dataId?: number
  level?: number

  remainingSeconds: number
  sourceTimestamp: number
  endAt: number

  notificationId?: string
  reminderLeadMinutes?: number

  systemAlarmId?: string
  systemAlarmCreatedAt?: number
  systemTimerId?: string
  systemTimerStartedAt?: number
}

export interface VillageRecord {
  id: string
  tag: string
  name: string

  sourceTimestamp: number
  createdAt: number
  updatedAt: number
  importedAt: number

  notificationMode: NotificationMode
  defaultReminderLeadMinutes?: number
  systemAlarmSyncEnabled?: boolean

  timers: VillageTimer[]
}
