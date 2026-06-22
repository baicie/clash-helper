import type { NotificationMode, VillageRecord } from '../src/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import * as IntentLauncher from 'expo-intent-launcher'
import { Alert, Platform } from 'react-native'

import App from '../App'
import { createVillageFromExport } from '../src/clash/parseClashExport'
import { saveSettings, saveVillages } from '../src/storage/villageStore'

const originalPlatformOS = Platform.OS
const startActivityAsyncMock = jest.mocked(IntentLauncher.startActivityAsync)

function createVillage(notificationMode: NotificationMode): VillageRecord {
  return {
    id: '#TEST',
    tag: '#TEST',
    name: '测试村庄',
    sourceTimestamp: 1,
    createdAt: 1,
    updatedAt: 1,
    importedAt: 1,
    notificationMode,
    timers: [
      {
        stableKey: 'timer-one:stable',
        id: 'timer-one',
        villageId: '#TEST',
        sourceGroup: 'buildings',
        scope: 'home',
        title: '项目一',
        remainingSeconds: 60,
        sourceTimestamp: 1,
        endAt: 61_000,
      },
      {
        stableKey: 'timer-two:stable',
        id: 'timer-two',
        villageId: '#TEST',
        sourceGroup: 'heroes',
        scope: 'home',
        title: '项目二',
        remainingSeconds: 120,
        sourceTimestamp: 1,
        endAt: 121_000,
      },
    ],
  }
}

describe('app smoke tests', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    })
  })

  it('renders the app title', async () => {
    const screen = await render(<App />)
    expect(screen.getByText('Clash Helper')).toBeTruthy()
  })

  it('renders default notification mode selector', async () => {
    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('menu-button'))
    await fireEvent.press(screen.getByTestId('menu-view-settings'))

    expect(screen.getByText('闹钟提醒')).toBeTruthy()
    expect(screen.getByText('连续倒计时')).toBeTruthy()
    expect(screen.getByText('普通通知')).toBeTruthy()
    expect(screen.getByText('关闭提醒')).toBeTruthy()
  })

  it('renders Android background reliability settings', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })

    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('menu-button'))
    await fireEvent.press(screen.getByTestId('menu-view-settings'))

    expect(screen.getByTestId('open-auto-start-settings-button')).toBeTruthy()
    expect(screen.getByTestId('open-battery-settings-button')).toBeTruthy()
    expect(screen.getByTestId('open-notification-settings-button')).toBeTruthy()
  })

  it('renders import section', async () => {
    const screen = await render(<App />)

    expect(screen.queryByText('导入 / 更新村庄')).toBeNull()
    await fireEvent.press(screen.getByTestId('add-village-button'))

    expect(screen.getAllByText('导入新村庄')).toHaveLength(2)
    expect(screen.getByTestId('import-textarea')).toBeTruthy()
    expect(screen.getByTestId('import-button')).toBeTruthy()
  })

  it('opens a targeted update form from village details', async () => {
    await saveVillages([createVillage('alarm')])
    const screen = await render(<App />)

    await fireEvent.press(await screen.findByTestId('village-item-#TEST'))
    await fireEvent.press(screen.getByTestId('update-village-button'))

    expect(screen.getAllByText('更新测试村庄')).toHaveLength(2)
    expect(screen.getByTestId('import-textarea')).toBeTruthy()
  })

  it('does not dismiss existing alarms during automatic foreground sync', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    const now = new Date(2026, 0, 1, 21).getTime()
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const village = createVillage('alarm')
    village.systemAlarmSyncEnabled = true
    village.timers = [
      {
        ...village.timers[0],
        endAt: new Date(2026, 0, 1, 23).getTime(),
        systemAlarmId: 'existing-night-alarm',
      },
    ]
    await saveVillages([village])

    const screen = await render(<App />)
    await screen.findByTestId('village-item-#TEST')

    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalledWith(
      'android.intent.action.DISMISS_ALARM',
      expect.anything(),
    )
  })

  it('renders empty villages state', async () => {
    const screen = await render(<App />)
    expect(screen.getByText('还没有导入任何村庄。')).toBeTruthy()
  })

  it('shows error alert when import empty json', async () => {
    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('add-village-button'))
    await fireEvent.changeText(screen.getByTestId('import-textarea'), '')
    await fireEvent.press(screen.getByTestId('import-button'))

    expect(Alert.alert).toHaveBeenCalledWith(
      '导入失败',
      '请先粘贴村庄导出 JSON',
    )
  })

  it('shows error alert when import invalid json', async () => {
    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('add-village-button'))
    await fireEvent.changeText(
      screen.getByTestId('import-textarea'),
      '{invalid json',
    )
    await fireEvent.press(screen.getByTestId('import-button'))

    expect(Alert.alert).toHaveBeenCalledWith(
      '导入失败',
      expect.stringContaining('JSON'),
    )
  })

  it('does not update an existing village from the new-village entry point', async () => {
    await saveVillages([createVillage('alarm')])
    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('add-village-button'))
    await fireEvent.changeText(
      screen.getByTestId('import-textarea'),
      JSON.stringify({ tag: '#TEST', timestamp: 100 }),
    )
    await fireEvent.press(screen.getByTestId('import-button'))

    expect(Alert.alert).toHaveBeenCalledWith(
      '村庄已存在',
      expect.stringContaining('点击右上角“更新”'),
    )
    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalledWith(
      'android.intent.action.DISMISS_ALARM',
      expect.anything(),
    )
  })

  it('stages alarm changes during JSON update and syncs only on demand', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    jest.spyOn(Date, 'now').mockReturnValue(100_000)
    const oldExport = {
      tag: '#UPDATE',
      timestamp: 100,
      buildings: [{ data: 1000001, lvl: 1, timer: 60 }],
    }
    const existing = createVillageFromExport(oldExport, {
      importedAt: 100_000,
    })
    existing.systemAlarmSyncEnabled = true
    existing.timers[0].systemAlarmId = 'old-alarm'
    await saveVillages([existing])
    await saveSettings({
      defaultNotificationMode: 'alarm',
      defaultReminderLeadMinutes: 0,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 10,
    })

    const screen = await render(<App />)
    await fireEvent.press(await screen.findByTestId('village-item-#UPDATE'))
    await fireEvent.press(screen.getByTestId('update-village-button'))
    await fireEvent.changeText(
      screen.getByTestId('import-textarea'),
      JSON.stringify({
        tag: '#UPDATE',
        timestamp: 200,
        buildings: [{ data: 1000002, lvl: 1, timer: 60 }],
      }),
    )
    await fireEvent.press(screen.getByTestId('import-button'))

    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledWith(
      '更新成功',
      expect.stringContaining('待清理旧闹钟 1 个，待创建新闹钟 1 个'),
    )

    await fireEvent.press(screen.getByTestId('create-all-system-alarms-button'))

    await waitFor(() =>
      expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
        1,
        'android.intent.action.DISMISS_ALARM',
        expect.any(Object),
      ),
    )
    expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
      2,
      'android.intent.action.SET_ALARM',
      expect.any(Object),
    )
  })

  it('creates an Android system alarm for alarm test mode', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    jest.spyOn(Date, 'now').mockReturnValue(1_000)

    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('menu-button'))
    await fireEvent.press(screen.getByTestId('menu-view-test'))
    await fireEvent.press(screen.getByTestId('run-test-notification-button'))

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.SET_ALARM',
      {
        extra: {
          'android.intent.extra.alarm.HOUR': new Date(60_000).getHours(),
          'android.intent.extra.alarm.MINUTES': new Date(60_000).getMinutes(),
          'android.intent.extra.alarm.MESSAGE': 'Clash Helper 闹钟测试',
          'android.intent.extra.alarm.SKIP_UI': true,
        },
      },
    )
  })

  it('starts the nearest Android system timer in continuous mode', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
    await saveVillages([createVillage('countdown')])

    await render(<App />)

    await waitFor(() =>
      expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
        'android.intent.action.SET_TIMER',
        {
          extra: {
            'android.intent.extra.alarm.LENGTH': 60,
            'android.intent.extra.alarm.MESSAGE': '测试村庄：项目一',
            'android.intent.extra.alarm.SKIP_UI': true,
          },
        },
      ),
    )
  })

  it('creates all eligible system alarms from the village action', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
    await saveVillages([createVillage('alarm')])
    await saveSettings({
      defaultNotificationMode: 'alarm',
      defaultReminderLeadMinutes: 0,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 10,
    })

    const screen = await render(<App />)
    await fireEvent.press(await screen.findByTestId('village-item-#TEST'))
    const button = await screen.findByTestId('create-all-system-alarms-button')

    await fireEvent.press(button)

    await waitFor(() =>
      expect(IntentLauncher.startActivityAsync).toHaveBeenCalledTimes(2),
    )
    expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
      1,
      'android.intent.action.SET_ALARM',
      expect.objectContaining({
        extra: expect.objectContaining({
          'android.intent.extra.alarm.MESSAGE': '项目一',
          'android.intent.extra.alarm.SKIP_UI': true,
        }),
      }),
    )
  })

  it('does not create alarms automatically when the app starts', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    const now = new Date(2026, 0, 1, 12).getTime()
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const village = createVillage('alarm')
    village.systemAlarmSyncEnabled = true
    village.timers = [
      {
        ...village.timers[0],
        endAt: now + 23 * 60 * 60 * 1000,
      },
    ]
    await saveVillages([village])
    await saveSettings({
      defaultNotificationMode: 'alarm',
      defaultReminderLeadMinutes: 0,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 10,
    })

    const screen = await render(<App />)
    await screen.findByTestId('village-item-#TEST')

    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalledWith(
      'android.intent.action.SET_ALARM',
      expect.anything(),
    )
  })

  it('skips batch alarms during the default quiet period', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    const now = new Date(2026, 0, 1, 21).getTime()
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const village = createVillage('alarm')
    village.timers = village.timers.map((timer, index) => ({
      ...timer,
      endAt: new Date(2026, 0, 1, 23, index * 10).getTime(),
    }))
    await saveVillages([village])

    const screen = await render(<App />)
    await fireEvent.press(await screen.findByTestId('village-item-#TEST'))
    await fireEvent.press(screen.getByTestId('create-all-system-alarms-button'))

    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalledWith(
      'android.intent.action.SET_ALARM',
      expect.anything(),
    )
    expect(Alert.alert).toHaveBeenCalledWith(
      '系统闹钟同步完成',
      expect.stringContaining('休息时段跳过 2 个'),
    )
  })

  it('shows the default quiet hours in settings', async () => {
    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('menu-button'))
    await fireEvent.press(screen.getByTestId('menu-view-settings'))

    expect(screen.getByTestId('quiet-hours-switch').props.value).toBe(true)
    expect(screen.getByTestId('quiet-hours-start-input').props.value).toBe('22')
    expect(screen.getByTestId('quiet-hours-end-input').props.value).toBe('10')
  })

  it('clears expired alarm records from village details', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    jest.spyOn(Date, 'now').mockReturnValue(70_000)
    const village = createVillage('alarm')
    village.timers[0].systemAlarmId = 'system-alarm:60000'
    await saveVillages([village])

    const screen = await render(<App />)
    await fireEvent.press(await screen.findByTestId('village-item-#TEST'))
    await fireEvent.press(screen.getByTestId('clear-expired-alarms-button'))

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '已清理闹钟记录',
        expect.stringContaining('1 条应用记录'),
        expect.any(Array),
      ),
    )
  })

  it('opens the system clock when Expo Go cannot create a system alarm', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    })
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
    startActivityAsyncMock.mockRejectedValueOnce(
      new Error('requires com.android.alarm.permission.SET_ALARM'),
    )

    const screen = await render(<App />)

    await fireEvent.press(screen.getByTestId('menu-button'))
    await fireEvent.press(screen.getByTestId('menu-view-test'))
    await fireEvent.press(screen.getByTestId('run-test-notification-button'))

    expect(IntentLauncher.startActivityAsync).toHaveBeenNthCalledWith(
      2,
      'android.intent.action.SHOW_ALARMS',
    )
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Expo Go'),
    )
  })
})
