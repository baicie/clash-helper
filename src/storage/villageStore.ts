import type { VillageRecord } from '../types'
import AsyncStorage from '@react-native-async-storage/async-storage'

const VILLAGES_STORAGE_KEY = 'clash-helper:villages:v1'

function isVillageList(value: unknown): value is VillageRecord[] {
  return Array.isArray(value)
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
