import type { VillageRecord, VillageTimer } from '../src/types'
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync'
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync'
import { Platform } from 'react-native'
import {
  initNotifications,
  scheduleTestNotification,
  scheduleTimerNotification,
} from '../src/notifications/notificationService'

const scheduleNotificationAsyncMock = jest.mocked(scheduleNotificationAsync)
const setNotificationChannelAsyncMock = jest.mocked(setNotificationChannelAsync)
const originalPlatformOS = Platform.OS

function createVillage(timer: VillageTimer): VillageRecord {
  return {
    id: '#TEST',
    tag: '#TEST',
    name: '测试村庄',
    sourceTimestamp: 1781860781,
    createdAt: 1781860781000,
    updatedAt: 1781860781000,
    importedAt: 1781860781000,
    notificationMode: 'alarm',
    defaultReminderLeadMinutes: 0,
    timers: [timer],
  }
}

function createTimer(overrides: Partial<VillageTimer> = {}): VillageTimer {
  return {
    stableKey: 'timer-1:stable',
    id: 'timer-1',
    villageId: '#TEST',
    sourceGroup: 'buildings',
    scope: 'home',
    title: '建筑升级',
    remainingSeconds: 3600,
    sourceTimestamp: 1781860781,
    endAt: 1781864381000,
    ...overrides,
  }
}

describe('notificationService', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1781860781000)
    scheduleNotificationAsyncMock.mockClear()
    setNotificationChannelAsyncMock.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    })
  })

  it('schedules timer notifications at the reminder lead time', async () => {
    const timer = createTimer({ reminderLeadMinutes: 10 })
    const village = createVillage(timer)

    await scheduleTimerNotification({
      village,
      timer,
      mode: 'alarm',
    })

    expect(scheduleNotificationAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          priority: 'max',
          sound: 'default',
          vibrate: [0, 600, 250, 600, 250, 900],
        }),
        trigger: expect.objectContaining({
          date: new Date(timer.endAt - 10 * 60 * 1000),
          channelId: 'clash-helper-alarm-v2',
        }),
      }),
    )
  })

  it('uses alarm priority for continuous countdown notifications', async () => {
    const timer = createTimer()
    const village = createVillage(timer)

    await scheduleTimerNotification({
      village,
      timer,
      mode: 'countdown',
    })

    expect(scheduleNotificationAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '连续倒计时完成',
          priority: 'max',
          vibrate: [0, 600, 250, 600, 250, 900],
        }),
      }),
    )
  })

  it('configures alarm channels for sound and vibration without custom sound casting', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })

    await initNotifications()

    expect(setNotificationChannelAsyncMock).toHaveBeenCalledWith(
      'clash-helper-alarm-v2',
      expect.objectContaining({
        enableVibrate: true,
        importance: 'max',
        vibrationPattern: [0, 600, 250, 600, 250, 900],
      }),
    )
    expect(
      setNotificationChannelAsyncMock.mock.calls[0]?.[1],
    ).not.toHaveProperty('sound')
  })

  it('does not schedule test notifications when mode is off', async () => {
    await scheduleTestNotification({ mode: 'off' })

    expect(scheduleNotificationAsyncMock).not.toHaveBeenCalled()
  })

  it('does not fail notification initialization when Android channel setup rejects', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    setNotificationChannelAsyncMock.mockRejectedValueOnce(
      new Error('ExpoNotificationChannelManager.setNotificationChannelAsync'),
    )

    await expect(initNotifications()).resolves.toBe(true)
  })
})
