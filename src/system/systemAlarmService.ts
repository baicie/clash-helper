import * as IntentLauncher from 'expo-intent-launcher'
import { Platform } from 'react-native'

const ACTION_SET_TIMER = 'android.intent.action.SET_TIMER'
const ACTION_SHOW_ALARMS = 'android.intent.action.SHOW_ALARMS'
const ACTION_SHOW_TIMERS = 'android.intent.action.SHOW_TIMERS'
const ACTION_MAIN = 'android.intent.action.MAIN'

const HONOR_CLOCK_PACKAGE = 'com.hihonor.deskclock'

const EXTRA_LENGTH = 'android.intent.extra.alarm.LENGTH'
const EXTRA_MESSAGE = 'android.intent.extra.alarm.MESSAGE'
const EXTRA_SKIP_UI = 'android.intent.extra.alarm.SKIP_UI'

export interface SystemCountdownTimerRequest {
  message: string
  endAt: number
  skipUi?: boolean
}

export interface CreateSystemCountdownTimerOptions {
  now?: number
  platform?: string
}

export function getRemainingSecondsForSystemTimer(
  endAt: number,
  now = Date.now(),
) {
  return Math.ceil((endAt - now) / 1000)
}

export function buildSystemTimerIntentParams(params: {
  message: string
  seconds: number
  skipUi?: boolean
}) {
  return {
    extra: {
      [EXTRA_LENGTH]: params.seconds,
      [EXTRA_MESSAGE]: params.message,
      [EXTRA_SKIP_UI]: params.skipUi ?? true,
    },
  }
}

export function isSystemCountdownTimerSupported(
  platform: string = Platform.OS,
) {
  return platform === 'android'
}

export function isSetAlarmPermissionError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('com.android.alarm.permission.SET_ALARM')
  )
}

export async function createSystemCountdownTimer(
  request: SystemCountdownTimerRequest,
  options?: CreateSystemCountdownTimerOptions,
) {
  const platform = options?.platform ?? Platform.OS

  if (!isSystemCountdownTimerSupported(platform)) {
    throw new Error('系统计时器目前只支持 Android')
  }

  const seconds = getRemainingSecondsForSystemTimer(
    request.endAt,
    options?.now ?? Date.now(),
  )

  if (seconds <= 0) {
    throw new Error('该倒计时已经结束，无法创建系统计时器')
  }

  await IntentLauncher.startActivityAsync(
    ACTION_SET_TIMER,
    buildSystemTimerIntentParams({
      message: request.message,
      seconds,
      skipUi: request.skipUi,
    }),
  )

  return `system-timer:${request.endAt}:${seconds}`
}

export async function openSystemAlarmApp(
  platform: 'ios' | 'android' = 'android',
) {
  if (!isSystemCountdownTimerSupported(platform)) {
    throw new Error('系统时钟页面目前只支持 Android')
  }

  const attempts = [
    () => IntentLauncher.startActivityAsync(ACTION_SHOW_ALARMS),
    () => IntentLauncher.startActivityAsync(ACTION_SHOW_TIMERS),
    () => IntentLauncher.startActivityAsync(ACTION_SET_TIMER),
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
