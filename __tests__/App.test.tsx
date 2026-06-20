import { fireEvent, render } from '@testing-library/react-native'
import * as IntentLauncher from 'expo-intent-launcher'
import { Alert, Platform } from 'react-native'

import App from '../App'

const originalPlatformOS = Platform.OS
const startActivityAsyncMock = jest.mocked(IntentLauncher.startActivityAsync)

describe('app smoke tests', () => {
  beforeEach(() => {
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

    await fireEvent.changeText(screen.getByTestId('import-textarea'), '')
    await fireEvent.press(screen.getByTestId('import-button'))

    expect(Alert.alert).toHaveBeenCalledWith(
      '导入失败',
      '请先粘贴村庄导出 JSON',
    )
  })

  it('shows error alert when import invalid json', async () => {
    const screen = await render(<App />)

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
          'android.intent.extra.alarm.SKIP_UI': false,
        },
      },
    )
  })

  it('opens the system clock when Expo Go cannot create a system timer', async () => {
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
