import * as IntentLauncher from 'expo-intent-launcher'

import {
  buildSystemAlarmIntentParams,
  createSystemAlarm,
  createSystemAlarmBatch,
  createSystemCountdownTimer,
  dismissSystemAlarm,
  getSystemAlarmTarget,
  isSetAlarmPermissionError,
  isSystemAlarmSupported,
  openSystemAlarmApp,
} from '../src/system/systemAlarmService'

describe('systemAlarmService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rounds the target up to a whole minute', () => {
    const endAt = new Date(2026, 0, 2, 7, 30, 15).getTime()

    expect(getSystemAlarmTarget(endAt)).toEqual({
      targetAt: new Date(2026, 0, 2, 7, 31).getTime(),
      hour: 7,
      minute: 31,
    })
  })

  it('builds Android alarm intent params and rounds up partial minutes', () => {
    const endAt = new Date(2026, 0, 2, 7, 30, 15).getTime()

    expect(
      buildSystemAlarmIntentParams({
        message: '大本营完成',
        endAt,
        skipUi: true,
      }),
    ).toEqual({
      extra: {
        'android.intent.extra.alarm.HOUR': 7,
        'android.intent.extra.alarm.MINUTES': 31,
        'android.intent.extra.alarm.MESSAGE': '大本营完成',
        'android.intent.extra.alarm.SKIP_UI': true,
      },
    })
  })

  it('checks supported platform', () => {
    expect(isSystemAlarmSupported('android')).toBe(true)
    expect(isSystemAlarmSupported('ios')).toBe(false)
  })

  it('detects Android SET_ALARM permission errors', () => {
    expect(
      isSetAlarmPermissionError(
        new Error('requires com.android.alarm.permission.SET_ALARM'),
      ),
    ).toBe(true)
    expect(isSetAlarmPermissionError(new Error('other error'))).toBe(false)
  })

  it('creates an Android system alarm instead of a countdown timer', async () => {
    const endAt = new Date(2026, 0, 2, 7, 30).getTime()
    const id = await createSystemAlarm(
      {
        message: '大本营完成',
        endAt,
      },
      {
        now: endAt - 60_000,
        platform: 'android',
      },
    )

    expect(id).toBe(`system-alarm:${endAt}`)
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.SET_ALARM',
      {
        extra: {
          'android.intent.extra.alarm.HOUR': 7,
          'android.intent.extra.alarm.MINUTES': 30,
          'android.intent.extra.alarm.MESSAGE': '大本营完成',
          'android.intent.extra.alarm.SKIP_UI': true,
        },
      },
    )
  })

  it('creates an Android system countdown timer', async () => {
    const id = await createSystemCountdownTimer(
      {
        message: '下一个升级',
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
          'android.intent.extra.alarm.MESSAGE': '下一个升级',
          'android.intent.extra.alarm.SKIP_UI': true,
        },
      },
    )
  })

  it('creates system alarms in a batch', async () => {
    const result = await createSystemAlarmBatch(
      [
        { id: 'one', message: '项目一', endAt: 61_000 },
        { id: 'two', message: '项目二', endAt: 121_000 },
      ],
      { now: 1_000, platform: 'android' },
    )

    expect(result.created).toEqual([
      { id: 'one', systemAlarmId: 'system-alarm:120000' },
      { id: 'two', systemAlarmId: 'system-alarm:180000' },
    ])
    expect(result.failed).toEqual([])
    expect(result.deferred).toEqual([])
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledTimes(2)
  })

  it('defers alarms beyond 24 hours instead of reporting failures', async () => {
    const now = 1_000
    const result = await createSystemAlarmBatch(
      [
        { id: 'soon', message: '最近项目', endAt: now + 60_000 },
        {
          id: 'later-1',
          message: '较远项目一',
          endAt: now + 25 * 60 * 60 * 1000,
        },
        {
          id: 'later-2',
          message: '较远项目二',
          endAt: now + 48 * 60 * 60 * 1000,
        },
      ],
      { now, platform: 'android' },
    )

    expect(result.created).toHaveLength(1)
    expect(result.deferred.map((item) => item.id)).toEqual([
      'later-1',
      'later-2',
    ])
    expect(result.failed).toEqual([])
  })

  it('dismisses an existing system alarm by time', async () => {
    const endAt = new Date(2026, 0, 2, 7, 30).getTime()

    await dismissSystemAlarm(endAt, 'android')

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.DISMISS_ALARM',
      {
        extra: {
          'android.intent.extra.alarm.SEARCH_MODE': 'android.time',
          'android.intent.extra.alarm.HOUR': 7,
          'android.intent.extra.alarm.MINUTES': 30,
          'android.intent.extra.alarm.IS_PM': false,
        },
      },
    )
  })

  it('dismisses an existing system alarm by its label when available', async () => {
    const endAt = new Date(2026, 0, 2, 19, 30).getTime()

    await dismissSystemAlarm(endAt, 'android', '夜世界建筑 · 双管加农炮')

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.DISMISS_ALARM',
      {
        extra: {
          'android.intent.extra.alarm.SEARCH_MODE': 'android.label',
          'android.intent.extra.alarm.MESSAGE': '夜世界建筑 · 双管加农炮',
        },
      },
    )
  })

  it('throws on unsupported platform', async () => {
    await expect(
      createSystemAlarm(
        {
          message: '大本营完成',
          endAt: 61_000,
        },
        {
          now: 1_000,
          platform: 'ios',
        },
      ),
    ).rejects.toThrow('系统闹钟目前只支持 Android')
  })

  it('throws when timer is done', async () => {
    await expect(
      createSystemAlarm(
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

  it('rejects alarms more than 24 hours away', async () => {
    await expect(
      createSystemAlarm(
        {
          message: '大本营完成',
          endAt: 24 * 60 * 60 * 1000 + 1,
        },
        {
          now: 0,
          platform: 'android',
        },
      ),
    ).rejects.toThrow('未来 24 小时内')
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
      'android.intent.action.SET_ALARM',
    )
  })
})
