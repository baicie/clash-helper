import '@testing-library/react-native'

jest.mock('@react-native-async-storage/async-storage', () => {
  return jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  )
})

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'mock-notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 'high', DEFAULT: 'default', MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 'public' },
  AndroidNotificationPriority: { DEFAULT: 'default', MAX: 'max' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))

jest.mock(
  'expo-notifications/build/cancelAllScheduledNotificationsAsync',
  () => ({
    cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  }),
)

jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-notifications/build/NotificationChannelManager.types', () => ({
  AndroidImportance: { HIGH: 'high', DEFAULT: 'default', MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 'public' },
}))

jest.mock('expo-notifications/build/NotificationPermissions', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}))

jest.mock('expo-notifications/build/Notifications.types', () => ({
  AndroidNotificationPriority: {
    DEFAULT: 'default',
    MAX: 'max',
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
}))

jest.mock('expo-notifications/build/NotificationsHandler', () => ({
  setNotificationHandler: jest.fn(),
}))

jest.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'mock-notification-id'),
}))

jest.mock('expo-notifications/build/setNotificationChannelAsync', () => ({
  setNotificationChannelAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => ({ resultCode: -1 })),
}))
