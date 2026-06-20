import * as IntentLauncher from 'expo-intent-launcher'
import { Linking, Platform } from 'react-native'

const ANDROID_PACKAGE_NAME = 'com.baicie.clashhelper'

const ACTION_APP_NOTIFICATION_SETTINGS =
  'android.settings.APP_NOTIFICATION_SETTINGS'
const ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS =
  'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'

const EXTRA_APP_PACKAGE = 'android.provider.extra.APP_PACKAGE'

interface ActivityAttempt {
  action: string
  params?: {
    packageName?: string
    className?: string
  }
}

export type AndroidVendor = 'honor' | 'xiaomi' | 'other'

export function getAndroidVendor(
  manufacturer = Platform.OS === 'android'
    ? Platform.constants.Manufacturer
    : '',
  brand = Platform.OS === 'android' ? Platform.constants.Brand : '',
): AndroidVendor {
  const identity = `${manufacturer} ${brand}`.toLowerCase()

  if (identity.includes('xiaomi') || identity.includes('redmi')) {
    return 'xiaomi'
  }

  if (identity.includes('honor') || identity.includes('hihonor')) {
    return 'honor'
  }

  return 'other'
}

function getAutoStartAttempts(vendor: AndroidVendor): ActivityAttempt[] {
  if (vendor === 'xiaomi') {
    return [
      {
        action: 'miui.intent.action.OP_AUTO_START',
        params: {
          packageName: 'com.miui.securitycenter',
          className:
            'com.miui.permcenter.autostart.AutoStartManagementActivity',
        },
      },
    ]
  }

  if (vendor === 'honor') {
    return [
      {
        action: 'android.intent.action.MAIN',
        params: {
          packageName: 'com.hihonor.systemmanager',
          className:
            'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity',
        },
      },
      {
        action: 'android.intent.action.MAIN',
        params: {
          packageName: 'com.huawei.systemmanager',
          className:
            'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity',
        },
      },
    ]
  }

  return []
}

async function startFirstAvailable(attempts: ActivityAttempt[]) {
  for (const attempt of attempts) {
    try {
      await IntentLauncher.startActivityAsync(attempt.action, attempt.params)
      return true
    } catch {
      // OEM settings activities vary by system version.
    }
  }

  return false
}

function assertAndroid(platform: string) {
  if (platform !== 'android') {
    throw new Error('后台权限设置目前只支持 Android')
  }
}

export async function openAutoStartSettings(options?: {
  platform?: string
  vendor?: AndroidVendor
}) {
  const platform = options?.platform ?? Platform.OS
  assertAndroid(platform)

  const opened = await startFirstAvailable(
    getAutoStartAttempts(options?.vendor ?? getAndroidVendor()),
  )

  if (!opened) {
    await Linking.openSettings()
  }
}

export async function openBatteryOptimizationSettings(platform = Platform.OS) {
  assertAndroid(platform)

  try {
    await IntentLauncher.startActivityAsync(
      ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
    )
  } catch {
    await Linking.openSettings()
  }
}

export async function openNotificationSettings(platform = Platform.OS) {
  assertAndroid(platform)

  try {
    await IntentLauncher.startActivityAsync(ACTION_APP_NOTIFICATION_SETTINGS, {
      extra: {
        [EXTRA_APP_PACKAGE]: ANDROID_PACKAGE_NAME,
      },
    })
  } catch {
    await Linking.openSettings()
  }
}
