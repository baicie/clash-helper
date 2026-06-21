import type {
  ClashExportItem,
  ClashVillageExport,
  NotificationMode,
  TimerSourceGroup,
  VillageRecord,
  VillageScope,
  VillageTimer,
} from '../types'
import { getClashDataName } from './clashDataNames'
import { normalizeTimestampSeconds } from './time'

interface TimerGroupConfig {
  key: TimerSourceGroup
  scope: VillageScope
  label: string
}

const TIMER_GROUPS: TimerGroupConfig[] = [
  { key: 'buildings', scope: 'home', label: '主世界建筑' },
  { key: 'traps', scope: 'home', label: '主世界陷阱' },
  { key: 'units', scope: 'home', label: '主世界兵种研究' },
  { key: 'siege_machines', scope: 'home', label: '攻城机器研究' },
  { key: 'heroes', scope: 'home', label: '主世界英雄' },
  { key: 'spells', scope: 'home', label: '主世界法术研究' },
  { key: 'pets', scope: 'home', label: '战宠' },
  { key: 'equipment', scope: 'home', label: '英雄装备' },

  { key: 'buildings2', scope: 'builder', label: '夜世界建筑' },
  { key: 'traps2', scope: 'builder', label: '夜世界陷阱' },
  { key: 'units2', scope: 'builder', label: '夜世界兵种研究' },
  { key: 'heroes2', scope: 'builder', label: '夜世界英雄' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPositiveSeconds(value: unknown) {
  if (typeof value !== 'number') {
    return undefined
  }

  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return Math.floor(value)
}

export function normalizeVillageTag(tag: unknown) {
  const text = typeof tag === 'string' ? tag.trim().toUpperCase() : ''

  if (!text) {
    return `#LOCAL-${Date.now()}`
  }

  return text.startsWith('#') ? text : `#${text}`
}

/**
 * Stable key used by alarm reconciliation to match the same timer item across
 * village re-imports. Does NOT include endAt so it stays stable as long as the
 * item type (dataId) and level haven't changed.
 */
function buildTimerStableKey(params: {
  villageId: string
  sourceGroup: TimerSourceGroup
  dataId?: number
  level?: number
}) {
  return [
    params.villageId,
    params.sourceGroup,
    params.dataId ?? 'unknown',
    params.level ?? 'unknown',
  ].join(':')
}

function buildTimerId(params: {
  villageId: string
  sourceGroup: TimerSourceGroup
  dataId?: number
  level?: number
  endAt: number
  index: number
}) {
  return [
    params.villageId,
    params.sourceGroup,
    params.dataId ?? 'unknown',
    params.level ?? 'unknown',
    params.endAt,
    params.index,
  ].join(':')
}

function buildItemTitle(config: TimerGroupConfig, item: ClashExportItem) {
  // Use the Chinese name so the title reads cleanly both in the village list
  // and in the Android system clock (which truncates long labels). The raw
  // dataId is still available on `VillageTimer.dataId` for any future need.
  // For unknown items, show the level instead of the raw numeric ID so the
  // title stays readable (e.g. "夜世界建筑 · Lv.5" instead of
  // "夜世界建筑 · #1000036").
  const nameText = getClashDataName(item.data)
  const levelText = typeof item.lvl === 'number' ? ` Lv.${item.lvl}` : ''

  if (nameText) {
    return `${config.label} · ${nameText}${levelText}`
  }

  // No known name — show the level if available, otherwise a bare category.
  return levelText ? `${config.label}${levelText}` : config.label
}

function createTimer(params: {
  villageId: string
  sourceGroup: TimerSourceGroup
  scope: VillageScope
  title: string
  dataId?: number
  level?: number
  remainingSeconds: number
  sourceTimestamp: number
  index: number
}): VillageTimer {
  const endAt = (params.sourceTimestamp + params.remainingSeconds) * 1000

  return {
    stableKey: buildTimerStableKey({
      villageId: params.villageId,
      sourceGroup: params.sourceGroup,
      dataId: params.dataId,
      level: params.level,
    }),
    id: buildTimerId({
      villageId: params.villageId,
      sourceGroup: params.sourceGroup,
      dataId: params.dataId,
      level: params.level,
      endAt,
      index: params.index,
    }),
    villageId: params.villageId,
    sourceGroup: params.sourceGroup,
    scope: params.scope,
    title: params.title,
    dataId: params.dataId,
    level: params.level,
    remainingSeconds: params.remainingSeconds,
    sourceTimestamp: params.sourceTimestamp,
    endAt,
  }
}

function applyReminderLeadMinutes(
  timers: VillageTimer[],
  params: {
    existing?: VillageRecord
    defaultReminderLeadMinutes: number
  },
) {
  const existingTimersByStableKey = new Map(
    params.existing?.timers.map((timer) => [timer.stableKey, timer]) ?? [],
  )

  return timers.map((timer) => {
    const existingTimer = existingTimersByStableKey.get(timer.stableKey)

    return {
      ...timer,
      reminderLeadMinutes:
        existingTimer?.reminderLeadMinutes ?? params.defaultReminderLeadMinutes,
      systemAlarmId: existingTimer?.systemAlarmId,
      systemAlarmCreatedAt: existingTimer?.systemAlarmCreatedAt,
      systemTimerId: existingTimer?.systemTimerId,
      systemTimerStartedAt: existingTimer?.systemTimerStartedAt,
    }
  })
}

export function parseClashVillageExportText(text: string): ClashVillageExport {
  const content = text.trim()

  if (!content) {
    throw new Error('请先粘贴村庄导出 JSON')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('JSON 格式不正确，请确认复制的是完整村庄导出数据')
  }

  if (!isRecord(parsed)) {
    throw new Error('导入内容不是有效对象')
  }

  return parsed as ClashVillageExport
}

export function parseTimersFromExport(
  exported: ClashVillageExport,
  villageId: string,
  importedAt = Date.now(),
) {
  const sourceTimestamp = normalizeTimestampSeconds(
    exported.timestamp,
    importedAt,
  )
  const timers: VillageTimer[] = []

  for (const config of TIMER_GROUPS) {
    const list = exported[config.key]

    if (!Array.isArray(list)) {
      continue
    }

    list.forEach((item, index) => {
      const remainingSeconds = readPositiveSeconds(item.timer)

      if (!remainingSeconds) {
        return
      }

      timers.push(
        createTimer({
          villageId,
          sourceGroup: config.key,
          scope: config.scope,
          title: buildItemTitle(config, item),
          dataId: item.data,
          level: item.lvl,
          remainingSeconds,
          sourceTimestamp,
          index,
        }),
      )
    })
  }

  exported.helpers?.forEach((helper, index) => {
    const remainingSeconds = readPositiveSeconds(helper.helper_cooldown)

    if (!remainingSeconds) {
      return
    }

    const name = getClashDataName(helper.data)
    const title = name
      ? `助手冷却 · ${name}`
      : `助手冷却${typeof helper.data === 'number' ? ` · #${helper.data}` : ''}`

    timers.push(
      createTimer({
        villageId,
        sourceGroup: 'helpers',
        scope: 'system',
        title,
        dataId: helper.data,
        level: helper.lvl,
        remainingSeconds,
        sourceTimestamp,
        index,
      }),
    )
  })

  const clocktowerCooldown = readPositiveSeconds(
    exported.boosts?.clocktower_cooldown,
  )

  if (clocktowerCooldown) {
    timers.push(
      createTimer({
        villageId,
        sourceGroup: 'boosts',
        scope: 'builder',
        title: '夜世界钟楼冷却',
        remainingSeconds: clocktowerCooldown,
        sourceTimestamp,
        index: 0,
      }),
    )
  }

  return timers.sort((a, b) => a.endAt - b.endAt)
}

export function createVillageFromExport(
  exported: ClashVillageExport,
  options?: {
    existing?: VillageRecord
    notificationMode?: NotificationMode
    defaultReminderLeadMinutes?: number
    importedAt?: number
  },
): VillageRecord {
  const importedAt = options?.importedAt ?? Date.now()
  const tag = normalizeVillageTag(exported.tag)
  const existing = options?.existing
  const sourceTimestamp = normalizeTimestampSeconds(
    exported.timestamp,
    importedAt,
  )

  const defaultReminderLeadMinutes =
    existing?.defaultReminderLeadMinutes ??
    options?.defaultReminderLeadMinutes ??
    0
  const timers = applyReminderLeadMinutes(
    parseTimersFromExport(exported, tag, importedAt),
    {
      existing,
      defaultReminderLeadMinutes,
    },
  )

  return {
    id: tag,
    tag,
    name: existing?.name ?? tag,
    sourceTimestamp,
    createdAt: existing?.createdAt ?? importedAt,
    updatedAt: importedAt,
    importedAt,
    notificationMode:
      existing?.notificationMode ?? options?.notificationMode ?? 'alarm',
    defaultReminderLeadMinutes,
    systemAlarmSyncEnabled:
      existing?.systemAlarmSyncEnabled ??
      existing?.timers.some((timer) => Boolean(timer.systemAlarmId)),
    timers,
  }
}

export function getActiveTimers(village: VillageRecord, now = Date.now()) {
  return village.timers.filter((timer) => timer.endAt > now)
}

export function getNextActiveTimer(village: VillageRecord, now = Date.now()) {
  return getActiveTimers(village, now).reduce<VillageTimer | undefined>(
    (nearest, timer) => {
      if (!nearest || timer.endAt < nearest.endAt) {
        return timer
      }

      return nearest
    },
    undefined,
  )
}

export function getDoneTimers(village: VillageRecord, now = Date.now()) {
  return village.timers.filter((timer) => timer.endAt <= now)
}
