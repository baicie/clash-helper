import type { NotificationMode, VillageRecord } from '../src/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import * as IntentLauncher from 'expo-intent-launcher'
import { Alert, Platform } from 'react-native'

import App from '../App'
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

    expect(screen.getByText('导入 / 更新村庄')).toBeTruthy()
    expect(screen.getByTestId('import-textarea')).toBeTruthy()
    expect(screen.getByTestId('import-button')).toBeTruthy()
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
          'android.intent.extra.alarm.MESSAGE': '测试村庄：项目一 已完成',
          'android.intent.extra.alarm.SKIP_UI': true,
        }),
      }),
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
      '已跳过休息时段',
      expect.stringContaining('2 个项目'),
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
