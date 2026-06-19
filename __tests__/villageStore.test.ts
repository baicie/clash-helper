import type { VillageRecord } from '../src/types'
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  clearVillages,
  loadVillages,
  removeVillage,
  saveVillages,
  updateVillage,
  upsertVillage,
} from '../src/storage/villageStore'

function createVillage(id: string, updatedAt: number): VillageRecord {
  return {
    id,
    tag: id,
    name: id,
    sourceTimestamp: 1,
    createdAt: 1,
    updatedAt,
    importedAt: updatedAt,
    notificationMode: 'alarm',
    timers: [],
  }
}

describe('villageStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('loads empty list by default', async () => {
    await expect(loadVillages()).resolves.toEqual([])
  })

  it('saves and loads villages', async () => {
    const villages = [createVillage('#A', 1)]

    await saveVillages(villages)

    await expect(loadVillages()).resolves.toEqual(villages)
  })

  it('clears villages', async () => {
    await saveVillages([createVillage('#A', 1)])
    await clearVillages()

    await expect(loadVillages()).resolves.toEqual([])
  })

  it('upserts and sorts by updatedAt desc', () => {
    const a = createVillage('#A', 1)
    const b = createVillage('#B', 2)
    const a2 = createVillage('#A', 3)

    expect(upsertVillage([a, b], a2).map((item) => item.id)).toEqual([
      '#A',
      '#B',
    ])
  })

  it('updates village', () => {
    const village = createVillage('#A', 1)

    const next = updateVillage([village], '#A', (item) => ({
      ...item,
      name: 'new name',
    }))

    expect(next[0].name).toBe('new name')
  })

  it('removes village', () => {
    expect(
      removeVillage([createVillage('#A', 1), createVillage('#B', 2)], '#A'),
    ).toHaveLength(1)
  })
})
