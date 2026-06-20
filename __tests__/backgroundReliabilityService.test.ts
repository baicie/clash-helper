import * as IntentLauncher from 'expo-intent-launcher'
import { Linking } from 'react-native'

import {
  getAndroidVendor,
  openAutoStartSettings,
  openBatteryOptimizationSettings,
  openNotificationSettings,
} from '../src/system/backgroundReliabilityService'

describe('backgroundReliabilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('detects Xiaomi and Honor devices', () => {
    expect(getAndroidVendor('Xiaomi', 'Redmi')).toBe('xiaomi')
    expect(getAndroidVendor('HONOR', 'HONOR')).toBe('honor')
    expect(getAndroidVendor('Google', 'google')).toBe('other')
  })

  it('opens Xiaomi auto-start management', async () => {
    await openAutoStartSettings({ platform: 'android', vendor: 'xiaomi' })

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'miui.intent.action.OP_AUTO_START',
      {
        packageName: 'com.miui.securitycenter',
        className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
      },
    )
  })

  it('falls back to app settings when an OEM page is unavailable', async () => {
    jest
      .mocked(IntentLauncher.startActivityAsync)
      .mockRejectedValue(new Error('activity not found'))

    await openAutoStartSettings({ platform: 'android', vendor: 'honor' })

    expect(Linking.openSettings).toHaveBeenCalled()
  })

  it('opens standard battery optimization settings', async () => {
    await openBatteryOptimizationSettings('android')

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
    )
  })

  it('opens this app notification settings', async () => {
    await openNotificationSettings('android')

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.settings.APP_NOTIFICATION_SETTINGS',
      {
        extra: {
          'android.provider.extra.APP_PACKAGE': 'com.baicie.clashhelper',
        },
      },
    )
  })
})
