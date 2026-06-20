import type { AppSettings, VillageRecord } from '../types'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { normalizeHour } from '../settings/quietHours'

const VILLAGES_STORAGE_KEY = 'clash-helper:villages:v1'
const SETTINGS_STORAGE_KEY = 'clash-helper:settings:v1'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultNotificationMode: 'alarm',
  defaultReminderLeadMinutes: 0,
  quietHoursEnabled: true,
  quietHoursStart: 22,
  quietHoursEnd: 10,
}

function isVillageList(value: unknown): value is VillageRecord[] {
  return Array.isArray(value)
}

function normalizeReminderLeadMinutes(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}

function normalizeSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_APP_SETTINGS
  }

  const settings = value as Partial<AppSettings>

  return {
    defaultNotificationMode:
      settings.defaultNotificationMode === 'alarm' ||
      settings.defaultNotificationMode === 'countdown' ||
      settings.defaultNotificationMode === 'notification' ||
      settings.defaultNotificationMode === 'off'
        ? settings.defaultNotificationMode
        : DEFAULT_APP_SETTINGS.defaultNotificationMode,
    defaultReminderLeadMinutes: normalizeReminderLeadMinutes(
      settings.defaultReminderLeadMinutes,
    ),
    quietHoursEnabled:
      typeof settings.quietHoursEnabled === 'boolean'
        ? settings.quietHoursEnabled
        : DEFAULT_APP_SETTINGS.quietHoursEnabled,
    quietHoursStart: normalizeHour(
      settings.quietHoursStart,
      DEFAULT_APP_SETTINGS.quietHoursStart,
    ),
    quietHoursEnd: normalizeHour(
      settings.quietHoursEnd,
      DEFAULT_APP_SETTINGS.quietHoursEnd,
    ),
  }
}

export async function loadVillages(): Promise<VillageRecord[]> {
  const raw = await AsyncStorage.getItem(VILLAGES_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!isVillageList(parsed)) {
      return []
    }

    return parsed
  } catch {
    return []
  }
}

export async function saveVillages(villages: VillageRecord[]) {
  await AsyncStorage.setItem(VILLAGES_STORAGE_KEY, JSON.stringify(villages))
}

export async function clearVillages() {
  await AsyncStorage.removeItem(VILLAGES_STORAGE_KEY)
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)

  if (!raw) {
    return DEFAULT_APP_SETTINGS
  }

  try {
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_APP_SETTINGS
  }
}

export async function saveSettings(settings: AppSettings) {
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeSettings(settings)),
  )
}

export function upsertVillage(
  villages: VillageRecord[],
  village: VillageRecord,
) {
  const rest = villages.filter((item) => item.id !== village.id)

  return [village, ...rest].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function updateVillage(
  villages: VillageRecord[],
  villageId: string,
  updater: (village: VillageRecord) => VillageRecord,
) {
  return villages.map((village) =>
    village.id === villageId ? updater(village) : village,
  )
}

export function removeVillage(villages: VillageRecord[], villageId: string) {
  return villages.filter((village) => village.id !== villageId)
}
