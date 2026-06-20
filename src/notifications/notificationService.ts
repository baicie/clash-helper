import type { NotificationMode, VillageRecord, VillageTimer } from '../types'
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync'
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync'
import {
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications/build/NotificationChannelManager.types'
import { requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions'
import {
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types'
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler'
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync'
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync'
import { Platform } from 'react-native'

const ALARM_CHANNEL_ID = 'clash-helper-alarm-v2'
const NORMAL_CHANNEL_ID = 'clash-helper-normal-v2'

const ALARM_VIBRATION_PATTERN = [0, 600, 250, 600, 250, 900]
const NORMAL_VIBRATION_PATTERN = [0, 250]

let androidChannelsReady = Platform.OS !== 'android'

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: AndroidNotificationPriority.MAX,
  }),
})

export async function initNotifications() {
  const permission = await requestPermissionsAsync()

  if (Platform.OS === 'android') {
    androidChannelsReady = await configureAndroidNotificationChannels()
  }

  return permission.granted
}

async function configureAndroidNotificationChannels() {
  try {
    await setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Clash Helper 闹钟提醒',
      importance: AndroidImportance.MAX,
      vibrationPattern: ALARM_VIBRATION_PATTERN,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    })

    await setNotificationChannelAsync(NORMAL_CHANNEL_ID, {
      name: 'Clash Helper 普通提醒',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: NORMAL_VIBRATION_PATTERN,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    })

    return true
  } catch {
    return false
  }
}

function getNotificationChannelId(mode: NotificationMode) {
  if (Platform.OS === 'android' && !androidChannelsReady) {
    return undefined
  }

  return isUrgentMode(mode) ? ALARM_CHANNEL_ID : NORMAL_CHANNEL_ID
}

function getNotificationPriority(mode: NotificationMode) {
  return isUrgentMode(mode)
    ? AndroidNotificationPriority.MAX
    : AndroidNotificationPriority.DEFAULT
}

function getVibrationPattern(mode: NotificationMode) {
  return isUrgentMode(mode) ? ALARM_VIBRATION_PATTERN : NORMAL_VIBRATION_PATTERN
}

function isUrgentMode(mode: NotificationMode) {
  return mode === 'alarm' || mode === 'countdown'
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

  const reminderLeadMinutes = timer.reminderLeadMinutes ?? 0
  const triggerAt = timer.endAt - reminderLeadMinutes * 60 * 1000

  if (triggerAt <= Date.now()) {
    return undefined
  }

  const channelId = getNotificationChannelId(mode)

  return scheduleNotificationAsync({
    content: {
      title:
        mode === 'alarm'
          ? '部落冲突升级提醒'
          : mode === 'countdown'
            ? '连续倒计时完成'
            : 'Clash Helper 提醒',
      body:
        reminderLeadMinutes > 0
          ? `${village.name}：${timer.title} 将在 ${reminderLeadMinutes} 分钟后完成`
          : `${village.name}：${timer.title} 已完成`,
      sound: 'default',
      priority: getNotificationPriority(mode),
      vibrate: getVibrationPattern(mode),
      data: {
        type: 'local_timer_done',
        villageId: village.id,
        villageTag: village.tag,
        timerId: timer.id,
        sourceGroup: timer.sourceGroup,
        endAt: timer.endAt,
        reminderLeadMinutes,
      },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerAt),
      ...(channelId ? { channelId } : {}),
    },
  })
}

export async function scheduleTestNotification(params: {
  mode: NotificationMode
  seconds?: number
}) {
  const seconds = Math.max(1, Math.floor(params.seconds ?? 5))

  if (params.mode === 'off') {
    return undefined
  }

  const channelId = getNotificationChannelId(params.mode)

  return scheduleNotificationAsync({
    content: {
      title:
        params.mode === 'alarm'
          ? 'Clash Helper 闹钟测试'
          : params.mode === 'countdown'
            ? 'Clash Helper 连续倒计时测试'
            : 'Clash Helper 通知测试',
      body: `这是一条 ${seconds} 秒后的测试提醒`,
      sound: 'default',
      priority: getNotificationPriority(params.mode),
      vibrate: getVibrationPattern(params.mode),
      data: {
        type: 'local_test_notification',
        mode: params.mode,
      },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(channelId ? { channelId } : {}),
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
