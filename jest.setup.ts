jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}))

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: () => Promise.resolve({ granted: true }),
  scheduleNotificationAsync: () => Promise.resolve('mock-notification-id'),
  cancelScheduledNotificationAsync: () => Promise.resolve(),
  cancelAllScheduledNotificationsAsync: () => Promise.resolve(),
  setNotificationHandler: () => {},
  setNotificationChannelAsync: () => Promise.resolve(),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))
