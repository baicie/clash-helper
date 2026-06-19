import type { NotificationMode, VillageRecord, VillageTimer } from '../types'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

const ALARM_CHANNEL_ID = 'clash-helper-alarm'
const NORMAL_CHANNEL_ID = 'clash-helper-normal'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function initNotifications() {
  const permission = await Notifications.requestPermissionsAsync()

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Clash Helper 闹钟提醒',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 300, 200, 300, 200, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })

    await Notifications.setNotificationChannelAsync(NORMAL_CHANNEL_ID, {
      name: 'Clash Helper 普通提醒',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
  }

  return permission.granted
}

export async function cancelTimerNotification(timer: VillageTimer) {
  if (!timer.notificationId) {
    return
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(timer.notificationId)
  } catch {
    // 通知可能已经触发或被系统清理，忽略即可。
  }
}

export async function cancelVillageNotifications(village: VillageRecord) {
  await Promise.all(village.timers.map(cancelTimerNotification))
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

export async function scheduleTimerNotification(params: {
  village: VillageRecord
  timer: VillageTimer
  mode: NotificationMode
}) {
  const { village, timer, mode } = params

  if (mode === 'off') {
    return undefined
  }

  if (timer.endAt <= Date.now()) {
    return undefined
  }

  const channelId = mode === 'alarm' ? ALARM_CHANNEL_ID : NORMAL_CHANNEL_ID

  const title = mode === 'alarm' ? '部落冲突升级完成' : 'Clash Helper 提醒'

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: `${village.name}：${timer.title} 已完成`,
      sound: 'default',
      data: {
        villageId: village.id,
        villageTag: village.tag,
        timerId: timer.id,
        sourceGroup: timer.sourceGroup,
        endAt: timer.endAt,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(timer.endAt),
      channelId,
    },
  })
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
