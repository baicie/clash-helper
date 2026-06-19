import * as IntentLauncher from 'expo-intent-launcher'

import {
  buildSystemTimerIntentParams,
  createSystemCountdownTimer,
  getRemainingSecondsForSystemTimer,
  isSetAlarmPermissionError,
  isSystemCountdownTimerSupported,
  openSystemAlarmApp,
} from '../src/system/systemAlarmService'

describe('systemAlarmService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calculates remaining seconds', () => {
    expect(getRemainingSecondsForSystemTimer(2000, 1000)).toBe(1)
    expect(getRemainingSecondsForSystemTimer(2500, 1000)).toBe(2)
  })

  it('builds Android timer intent params', () => {
    expect(
      buildSystemTimerIntentParams({
        message: '大本营完成',
        seconds: 60,
        skipUi: true,
      }),
    ).toEqual({
      extra: {
        'android.intent.extra.alarm.LENGTH': 60,
        'android.intent.extra.alarm.MESSAGE': '大本营完成',
        'android.intent.extra.alarm.SKIP_UI': true,
      },
    })
  })

  it('checks supported platform', () => {
    expect(isSystemCountdownTimerSupported('android')).toBe(true)
    expect(isSystemCountdownTimerSupported('ios')).toBe(false)
  })

  it('detects Android SET_ALARM permission errors', () => {
    expect(
      isSetAlarmPermissionError(
        new Error('requires com.android.alarm.permission.SET_ALARM'),
      ),
    ).toBe(true)
    expect(isSetAlarmPermissionError(new Error('other error'))).toBe(false)
  })

  it('creates Android system countdown timer', async () => {
    const id = await createSystemCountdownTimer(
      {
        message: '大本营完成',
        endAt: 61_000,
      },
      {
        now: 1_000,
        platform: 'android',
      },
    )

    expect(id).toBe('system-timer:61000:60')
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.SET_TIMER',
      {
        extra: {
          'android.intent.extra.alarm.LENGTH': 60,
          'android.intent.extra.alarm.MESSAGE': '大本营完成',
          'android.intent.extra.alarm.SKIP_UI': true,
        },
      },
    )
  })

  it('throws on unsupported platform', async () => {
    await expect(
      createSystemCountdownTimer(
        {
          message: '大本营完成',
          endAt: 61_000,
        },
        {
          now: 1_000,
          platform: 'ios',
        },
      ),
    ).rejects.toThrow('系统计时器目前只支持 Android')
  })

  it('throws when timer is done', async () => {
    await expect(
      createSystemCountdownTimer(
        {
          message: '大本营完成',
          endAt: 1_000,
        },
        {
          now: 2_000,
          platform: 'android',
        },
      ),
    ).rejects.toThrow('该倒计时已经结束')
  })
  it('falls back through system clock open actions', async () => {
    const startActivityAsyncMock = jest.mocked(
      IntentLauncher.startActivityAsync,
    )
    startActivityAsyncMock
      .mockRejectedValueOnce(new Error('no alarms activity'))
      .mockResolvedValueOnce({ resultCode: -1 })

    await openSystemAlarmApp('android')

    expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
      1,
      'android.intent.action.SHOW_ALARMS',
    )
    expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
      2,
      'android.intent.action.SHOW_TIMERS',
    )
  })
})
