import type { NotificationMode, VillageRecord, VillageTimer } from '../types'
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync'
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync'
import {
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications/build/NotificationChannelManager.types'
import { requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions'
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types'
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler'
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync'
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync'
import { Platform } from 'react-native'

const ALARM_CHANNEL_ID = 'clash-helper-alarm'
const NORMAL_CHANNEL_ID = 'clash-helper-normal'

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function initNotifications() {
  const permission = await requestPermissionsAsync()

  if (Platform.OS === 'android') {
    await setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Clash Helper 闹钟提醒',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 300, 200, 300, 200, 600],
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    })

    await setNotificationChannelAsync(NORMAL_CHANNEL_ID, {
      name: 'Clash Helper 普通提醒',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 200],
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    })
  }

  return permission.granted
}

export async function scheduleTimerNotification(params: {
  village: VillageRecord
  timer: VillageTimer
  mode: NotificationMode
}): Promise<string | undefined> {
  const { village, timer, mode } = params

  if (mode === 'off') {
    return undefined
  }

  if (timer.endAt <= Date.now()) {
    return undefined
  }

  const channelId = mode === 'alarm' ? ALARM_CHANNEL_ID : NORMAL_CHANNEL_ID

  return scheduleNotificationAsync({
    content: {
      title: mode === 'alarm' ? '部落冲突升级完成' : 'Clash Helper 提醒',
      body: `${village.name}：${timer.title} 已完成`,
      sound: 'default',
      data: {
        type: 'local_timer_done',
        villageId: village.id,
        villageTag: village.tag,
        timerId: timer.id,
        sourceGroup: timer.sourceGroup,
        endAt: timer.endAt,
      },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: new Date(timer.endAt),
      channelId,
    },
  })
}

export async function cancelTimerNotification(timer: VillageTimer) {
  if (!timer.notificationId) {
    return
  }

  try {
    await cancelScheduledNotificationAsync(timer.notificationId)
  } catch {
    // 通知可能已经触发，或者被系统清理；这里忽略即可。
  }
}

export async function cancelVillageNotifications(village: VillageRecord) {
  await Promise.all(village.timers.map(cancelTimerNotification))
}

export async function cancelAllNotifications() {
  await cancelAllScheduledNotificationsAsync()
}

export async function scheduleVillageNotifications(
  village: VillageRecord,
): Promise<VillageRecord> {
  const timers = await Promise.all(
    village.timers.map(async (timer) => {
      const notificationId = await scheduleTimerNotification({
        village,
        timer,
        mode: village.notificationMode,
      })

      return {
        ...timer,
        notificationId,
      }
    }),
  )

  return {
    ...village,
    timers,
  }
}

export async function rescheduleVillageNotifications(
  village: VillageRecord,
): Promise<VillageRecord> {
  await cancelVillageNotifications(village)

  const cleared: VillageRecord = {
    ...village,
    timers: village.timers.map((timer) => ({
      ...timer,
      notificationId: undefined,
    })),
  }

  return scheduleVillageNotifications(cleared)
}
