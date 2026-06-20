import * as IntentLauncher from 'expo-intent-launcher'
import { Platform } from 'react-native'

const ACTION_SET_ALARM = 'android.intent.action.SET_ALARM'
const ACTION_SHOW_ALARMS = 'android.intent.action.SHOW_ALARMS'
const ACTION_MAIN = 'android.intent.action.MAIN'

const HONOR_CLOCK_PACKAGE = 'com.hihonor.deskclock'
const MAX_SYSTEM_ALARM_DELAY_MS = 24 * 60 * 60 * 1000

const EXTRA_HOUR = 'android.intent.extra.alarm.HOUR'
const EXTRA_MINUTES = 'android.intent.extra.alarm.MINUTES'
const EXTRA_MESSAGE = 'android.intent.extra.alarm.MESSAGE'
const EXTRA_SKIP_UI = 'android.intent.extra.alarm.SKIP_UI'

export interface SystemAlarmRequest {
  message: string
  endAt: number
  skipUi?: boolean
}

export interface CreateSystemAlarmOptions {
  now?: number
  platform?: string
}

export function getSystemAlarmTarget(endAt: number) {
  const targetAt = Math.ceil(endAt / 60_000) * 60_000
  const target = new Date(targetAt)

  return {
    targetAt,
    hour: target.getHours(),
    minute: target.getMinutes(),
  }
}

export function buildSystemAlarmIntentParams(params: {
  message: string
  endAt: number
  skipUi?: boolean
}) {
  const target = getSystemAlarmTarget(params.endAt)

  return {
    extra: {
      [EXTRA_HOUR]: target.hour,
      [EXTRA_MINUTES]: target.minute,
      [EXTRA_MESSAGE]: params.message,
      [EXTRA_SKIP_UI]: params.skipUi ?? true,
    },
  }
}

export function isSystemAlarmSupported(platform: string = Platform.OS) {
  return platform === 'android'
}

export function isSetAlarmPermissionError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('com.android.alarm.permission.SET_ALARM')
  )
}

export async function createSystemAlarm(
  request: SystemAlarmRequest,
  options?: CreateSystemAlarmOptions,
) {
  const platform = options?.platform ?? Platform.OS
  const now = options?.now ?? Date.now()
  const delay = request.endAt - now

  if (!isSystemAlarmSupported(platform)) {
    throw new Error('系统闹钟目前只支持 Android')
  }

  if (delay <= 0) {
    throw new Error('该倒计时已经结束，无法创建系统闹钟')
  }

  if (delay > MAX_SYSTEM_ALARM_DELAY_MS) {
    throw new Error('系统闹钟只能设置未来 24 小时内的项目，请使用本地通知提醒')
  }

  await IntentLauncher.startActivityAsync(
    ACTION_SET_ALARM,
    buildSystemAlarmIntentParams(request),
  )

  return `system-alarm:${getSystemAlarmTarget(request.endAt).targetAt}`
}

export async function openSystemAlarmApp(
  platform: 'ios' | 'android' = 'android',
) {
  if (!isSystemAlarmSupported(platform)) {
    throw new Error('系统时钟页面目前只支持 Android')
  }

  const attempts = [
    () => IntentLauncher.startActivityAsync(ACTION_SHOW_ALARMS),
    () => IntentLauncher.startActivityAsync(ACTION_SET_ALARM),
    () =>
      IntentLauncher.startActivityAsync(ACTION_MAIN, {
        packageName: HONOR_CLOCK_PACKAGE,
      }),
  ]

  let lastError: unknown

  for (const attempt of attempts) {
    try {
      await attempt()
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('无法打开系统时钟')
}
