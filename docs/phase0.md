下面给一版**除服务端推送外的完整本地实现**。按你当前仓库来看，它还是 Expo SDK 56 模板，`package.json` 只有 Expo/RN 基础依赖，`App.tsx` 也还是模板入口，所以可以直接整体替换/新增这些文件。([GitHub][1])

这版实现目标：

```txt
1. 粘贴部落冲突导出的 JSON
2. 自动解析所有 timer / helper_cooldown / clocktower_cooldown
3. 支持多村庄管理
4. 同一 tag 再次导入时覆盖更新，并保留村庄昵称和提醒模式
5. 每个村庄可独立切换：
   - 闹钟提醒 alarm
   - 普通通知 notification
   - 关闭提醒 off
6. 倒计时完成后发本地通知
7. 删除村庄时取消该村庄全部通知
8. 切换提醒模式时取消旧通知并重新排期
9. 支持已完成任务展示和一键清理
10. 支持 dataId 中文名称映射扩展，但不强行猜未知 ID
```

本地倒计时通知不需要服务端；Expo 的 `expo-notifications` 支持本地一次性定时通知。远程推送才需要 Expo Push Token、FCM/APNs 或后端调用推送接口。([Expo Documentation][2])
另外，Android 真正的“精确闹钟”会碰到 Android 12/14 的 exact alarm 权限限制，新装应用在 Android 14 上通常不会默认授予 `SCHEDULE_EXACT_ALARM`，所以这版先做“闹钟风格的高优先级本地通知”。后续要做到系统闹钟级别，再进入原生 AlarmManager。([Android Developers][3])

---

# 1. 安装依赖

```bash
pnpm dlx expo install expo-notifications
pnpm dlx expo install @react-native-async-storage/async-storage
```

---

# 2. 目录结构

```txt
clash-helper/
├── App.tsx
├── app.json
├── package.json
├── src/
│   ├── clash/
│   │   ├── clashDataNames.ts
│   │   ├── parseClashExport.ts
│   │   └── time.ts
│   ├── notifications/
│   │   └── notificationService.ts
│   ├── storage/
│   │   └── villageStore.ts
│   └── types.ts
└── __tests__/
    ├── parseClashExport.test.ts
    └── time.test.ts
```

---

# 3. package.json

```json
{
  "name": "clash-helper",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@10.34.3",
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "build": "pnpm type-check",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "type-check": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\"",
    "test": "jest --watchAll=false",
    "check": "pnpm type-check && pnpm lint && pnpm format:check && pnpm test",
    "clean": "rimraf .expo dist coverage node_modules",
    "postinstall": "simple-git-hooks"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.2.0",
    "expo": "~56.0.12",
    "expo-notifications": "~0.33.0",
    "expo-status-bar": "~56.0.4",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.85.3",
    "react-native-web": "^0.21.2"
  },
  "devDependencies": {
    "@antfu/eslint-config": "^9.0.0",
    "@babel/core": "^7.25.2",
    "@eslint-react/eslint-plugin": "^5.9.0",
    "@react-native/jest-preset": "0.85.3",
    "@testing-library/react-native": "^14.0.0",
    "@types/jest": "^29.5.14",
    "@types/react": "~19.2.2",
    "@types/react-test-renderer": "^19.1.0",
    "eslint": "^10.5.0",
    "eslint-plugin-react-refresh": "^0.5.3",
    "jest": "^29.7.0",
    "jest-expo": "^56.0.5",
    "lint-staged": "^17.0.7",
    "prettier": "^3.8.4",
    "react-test-renderer": "19.2.3",
    "rimraf": "^6.1.3",
    "simple-git-hooks": "^2.13.1",
    "typescript": "~6.0.3"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"]
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged && pnpm type-check",
    "commit-msg": "node scripts/verify-commit.mjs"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

---

# 4. app.json

```json
{
  "expo": {
    "name": "Clash Helper",
    "slug": "clash-helper",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.baicie.clashhelper",
      "permissions": ["POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM", "VIBRATE"],
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "plugins": ["expo-notifications"],
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

---

# 5. src/types.ts

```ts
export type NotificationMode = 'alarm' | 'notification' | 'off'

export type VillageScope = 'home' | 'builder' | 'system'

export type TimerSourceGroup =
  | 'buildings'
  | 'traps'
  | 'units'
  | 'siege_machines'
  | 'heroes'
  | 'spells'
  | 'pets'
  | 'equipment'
  | 'buildings2'
  | 'traps2'
  | 'units2'
  | 'heroes2'
  | 'helpers'
  | 'boosts'

export interface ClashExportItem {
  data?: number
  lvl?: number
  timer?: number
  cnt?: number
  helper_cooldown?: number
  helper_recurrent?: boolean
}

export interface ClashVillageExport {
  tag?: string
  timestamp?: number

  helpers?: ClashExportItem[]

  buildings?: ClashExportItem[]
  traps?: ClashExportItem[]
  decos?: ClashExportItem[]
  obstacles?: ClashExportItem[]
  units?: ClashExportItem[]
  siege_machines?: ClashExportItem[]
  heroes?: ClashExportItem[]
  spells?: ClashExportItem[]
  pets?: ClashExportItem[]
  equipment?: ClashExportItem[]

  buildings2?: ClashExportItem[]
  traps2?: ClashExportItem[]
  decos2?: ClashExportItem[]
  obstacles2?: ClashExportItem[]
  units2?: ClashExportItem[]
  heroes2?: ClashExportItem[]

  boosts?: {
    clocktower_cooldown?: number
  }

  [key: string]: unknown
}

export interface VillageTimer {
  id: string
  villageId: string
  sourceGroup: TimerSourceGroup
  scope: VillageScope

  title: string
  dataId?: number
  level?: number

  remainingSeconds: number
  sourceTimestamp: number
  endAt: number

  notificationId?: string
}

export interface VillageRecord {
  id: string
  tag: string
  name: string

  sourceTimestamp: number
  createdAt: number
  updatedAt: number
  importedAt: number

  notificationMode: NotificationMode

  timers: VillageTimer[]
}
```

---

# 6. src/clash/clashDataNames.ts

这里先做**可扩展映射表**，不要硬猜未知 ID。后面你只要逐步补这个表，UI 会自动显示中文名。

```ts
export const CLASH_DATA_NAMES: Record<number, string> = {
  // 这里不要乱填不确定映射。
  // 后续可以按真实 dataId 逐步补充。
  //
  // 示例：
  // 1000001: '加农炮',
  // 26000010: '骷髅法术',
}

export function getClashDataName(dataId: number | undefined) {
  if (typeof dataId !== 'number') {
    return undefined
  }

  return CLASH_DATA_NAMES[dataId]
}
```

---

# 7. src/clash/time.ts

```ts
export function normalizeTimestampSeconds(
  timestamp: number | undefined,
  fallbackMs = Date.now(),
) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return Math.floor(fallbackMs / 1000)
  }

  // 兼容秒级 / 毫秒级时间戳。
  if (timestamp > 10_000_000_000) {
    return Math.floor(timestamp / 1000)
  }

  return Math.floor(timestamp)
}

export function secondsToMs(seconds: number) {
  return Math.floor(seconds) * 1000
}

export function formatDuration(ms: number) {
  if (ms <= 0) {
    return '已完成'
  }

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`
  }

  if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`
  }

  if (minutes > 0) {
    return `${minutes}分钟 ${seconds}秒`
  }

  return `${seconds}秒`
}

export function formatDateTime(timestampMs: number) {
  return new Date(timestampMs).toLocaleString()
}
```

---

# 8. src/clash/parseClashExport.ts

```ts
import type {
  ClashExportItem,
  ClashVillageExport,
  NotificationMode,
  TimerSourceGroup,
  VillageRecord,
  VillageScope,
  VillageTimer,
} from '../types'
import { getClashDataName } from './clashDataNames'
import { normalizeTimestampSeconds } from './time'

interface TimerGroupConfig {
  key: TimerSourceGroup
  scope: VillageScope
  label: string
}

const TIMER_GROUPS: TimerGroupConfig[] = [
  { key: 'buildings', scope: 'home', label: '主世界建筑' },
  { key: 'traps', scope: 'home', label: '主世界陷阱' },
  { key: 'units', scope: 'home', label: '主世界兵种研究' },
  { key: 'siege_machines', scope: 'home', label: '攻城机器研究' },
  { key: 'heroes', scope: 'home', label: '主世界英雄' },
  { key: 'spells', scope: 'home', label: '主世界法术研究' },
  { key: 'pets', scope: 'home', label: '战宠' },
  { key: 'equipment', scope: 'home', label: '英雄装备' },

  { key: 'buildings2', scope: 'builder', label: '夜世界建筑' },
  { key: 'traps2', scope: 'builder', label: '夜世界陷阱' },
  { key: 'units2', scope: 'builder', label: '夜世界兵种研究' },
  { key: 'heroes2', scope: 'builder', label: '夜世界英雄' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPositiveSeconds(value: unknown) {
  if (typeof value !== 'number') {
    return undefined
  }

  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return Math.floor(value)
}

export function normalizeVillageTag(tag: unknown) {
  const text = typeof tag === 'string' ? tag.trim().toUpperCase() : ''

  if (!text) {
    return `#LOCAL-${Date.now()}`
  }

  return text.startsWith('#') ? text : `#${text}`
}

function buildTimerId(params: {
  villageId: string
  sourceGroup: TimerSourceGroup
  dataId?: number
  level?: number
  endAt: number
  index: number
}) {
  return [
    params.villageId,
    params.sourceGroup,
    params.dataId ?? 'unknown',
    params.level ?? 'unknown',
    params.endAt,
    params.index,
  ].join(':')
}

function buildItemTitle(config: TimerGroupConfig, item: ClashExportItem) {
  const name = getClashDataName(item.data)
  const dataText = typeof item.data === 'number' ? `#${item.data}` : '未知 ID'
  const levelText = typeof item.lvl === 'number' ? ` Lv.${item.lvl}` : ''

  if (name) {
    return `${config.label} · ${name}${levelText}`
  }

  return `${config.label} · ${dataText}${levelText}`
}

function createTimer(params: {
  villageId: string
  sourceGroup: TimerSourceGroup
  scope: VillageScope
  title: string
  dataId?: number
  level?: number
  remainingSeconds: number
  sourceTimestamp: number
  index: number
}): VillageTimer {
  const endAt = (params.sourceTimestamp + params.remainingSeconds) * 1000

  return {
    id: buildTimerId({
      villageId: params.villageId,
      sourceGroup: params.sourceGroup,
      dataId: params.dataId,
      level: params.level,
      endAt,
      index: params.index,
    }),
    villageId: params.villageId,
    sourceGroup: params.sourceGroup,
    scope: params.scope,
    title: params.title,
    dataId: params.dataId,
    level: params.level,
    remainingSeconds: params.remainingSeconds,
    sourceTimestamp: params.sourceTimestamp,
    endAt,
  }
}

export function parseClashVillageExportText(text: string): ClashVillageExport {
  const content = text.trim()

  if (!content) {
    throw new Error('请先粘贴村庄导出 JSON')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('JSON 格式不正确，请确认复制的是完整村庄导出数据')
  }

  if (!isRecord(parsed)) {
    throw new Error('导入内容不是有效对象')
  }

  return parsed as ClashVillageExport
}

export function parseTimersFromExport(
  exported: ClashVillageExport,
  villageId: string,
  importedAt = Date.now(),
) {
  const sourceTimestamp = normalizeTimestampSeconds(
    exported.timestamp,
    importedAt,
  )
  const timers: VillageTimer[] = []

  for (const config of TIMER_GROUPS) {
    const list = exported[config.key]

    if (!Array.isArray(list)) {
      continue
    }

    list.forEach((item, index) => {
      const remainingSeconds = readPositiveSeconds(item.timer)

      if (!remainingSeconds) {
        return
      }

      timers.push(
        createTimer({
          villageId,
          sourceGroup: config.key,
          scope: config.scope,
          title: buildItemTitle(config, item),
          dataId: item.data,
          level: item.lvl,
          remainingSeconds,
          sourceTimestamp,
          index,
        }),
      )
    })
  }

  exported.helpers?.forEach((helper, index) => {
    const remainingSeconds = readPositiveSeconds(helper.helper_cooldown)

    if (!remainingSeconds) {
      return
    }

    const name = getClashDataName(helper.data)
    const title = name
      ? `助手冷却 · ${name}`
      : `助手冷却${typeof helper.data === 'number' ? ` · #${helper.data}` : ''}`

    timers.push(
      createTimer({
        villageId,
        sourceGroup: 'helpers',
        scope: 'system',
        title,
        dataId: helper.data,
        level: helper.lvl,
        remainingSeconds,
        sourceTimestamp,
        index,
      }),
    )
  })

  const clocktowerCooldown = readPositiveSeconds(
    exported.boosts?.clocktower_cooldown,
  )

  if (clocktowerCooldown) {
    timers.push(
      createTimer({
        villageId,
        sourceGroup: 'boosts',
        scope: 'builder',
        title: '夜世界钟楼冷却',
        remainingSeconds: clocktowerCooldown,
        sourceTimestamp,
        index: 0,
      }),
    )
  }

  return timers.sort((a, b) => a.endAt - b.endAt)
}

export function createVillageFromExport(
  exported: ClashVillageExport,
  options?: {
    existing?: VillageRecord
    notificationMode?: NotificationMode
    importedAt?: number
  },
): VillageRecord {
  const importedAt = options?.importedAt ?? Date.now()
  const tag = normalizeVillageTag(exported.tag)
  const existing = options?.existing
  const sourceTimestamp = normalizeTimestampSeconds(
    exported.timestamp,
    importedAt,
  )

  const timers = parseTimersFromExport(exported, tag, importedAt)

  return {
    id: tag,
    tag,
    name: existing?.name ?? tag,
    sourceTimestamp,
    createdAt: existing?.createdAt ?? importedAt,
    updatedAt: importedAt,
    importedAt,
    notificationMode:
      existing?.notificationMode ?? options?.notificationMode ?? 'alarm',
    timers,
  }
}

export function getActiveTimers(village: VillageRecord, now = Date.now()) {
  return village.timers.filter((timer) => timer.endAt > now)
}

export function getDoneTimers(village: VillageRecord, now = Date.now()) {
  return village.timers.filter((timer) => timer.endAt <= now)
}
```

---

# 9. src/storage/villageStore.ts

```ts
import type { VillageRecord } from '../types'
import AsyncStorage from '@react-native-async-storage/async-storage'

const VILLAGES_STORAGE_KEY = 'clash-helper:villages:v1'

function isVillageList(value: unknown): value is VillageRecord[] {
  return Array.isArray(value)
}

export async function loadVillages(): Promise<VillageRecord[]> {
  const raw = await AsyncStorage.getItem(VILLAGES_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!isVillageList(parsed)) {
      return []
    }

    return parsed
  } catch {
    return []
  }
}

export async function saveVillages(villages: VillageRecord[]) {
  await AsyncStorage.setItem(VILLAGES_STORAGE_KEY, JSON.stringify(villages))
}

export async function clearVillages() {
  await AsyncStorage.removeItem(VILLAGES_STORAGE_KEY)
}

export function upsertVillage(
  villages: VillageRecord[],
  village: VillageRecord,
) {
  const rest = villages.filter((item) => item.id !== village.id)

  return [village, ...rest].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function updateVillage(
  villages: VillageRecord[],
  villageId: string,
  updater: (village: VillageRecord) => VillageRecord,
) {
  return villages.map((village) =>
    village.id === villageId ? updater(village) : village,
  )
}

export function removeVillage(villages: VillageRecord[], villageId: string) {
  return villages.filter((village) => village.id !== villageId)
}
```

---

# 10. src/notifications/notificationService.ts

```ts
import type { NotificationMode, VillageRecord, VillageTimer } from '../types'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

const ALARM_CHANNEL_ID = 'clash-helper-alarm'
const NORMAL_CHANNEL_ID = 'clash-helper-normal'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function initNotifications() {
  const permission = await Notifications.requestPermissionsAsync()

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Clash Helper 闹钟提醒',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 300, 200, 300, 200, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })

    await Notifications.setNotificationChannelAsync(NORMAL_CHANNEL_ID, {
      name: 'Clash Helper 普通提醒',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
  }

  return permission.granted
}

export async function cancelTimerNotification(timer: VillageTimer) {
  if (!timer.notificationId) {
    return
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(timer.notificationId)
  } catch {
    // 通知可能已经触发或被系统清理，忽略即可。
  }
}

export async function cancelVillageNotifications(village: VillageRecord) {
  await Promise.all(village.timers.map(cancelTimerNotification))
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

export async function scheduleTimerNotification(params: {
  village: VillageRecord
  timer: VillageTimer
  mode: NotificationMode
}) {
  const { village, timer, mode } = params

  if (mode === 'off') {
    return undefined
  }

  if (timer.endAt <= Date.now()) {
    return undefined
  }

  const channelId = mode === 'alarm' ? ALARM_CHANNEL_ID : NORMAL_CHANNEL_ID

  const title = mode === 'alarm' ? '部落冲突升级完成' : 'Clash Helper 提醒'

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: `${village.name}：${timer.title} 已完成`,
      sound: 'default',
      data: {
        villageId: village.id,
        villageTag: village.tag,
        timerId: timer.id,
        sourceGroup: timer.sourceGroup,
        endAt: timer.endAt,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(timer.endAt),
      channelId,
    },
  })
}

export async function scheduleVillageNotifications(
  village: VillageRecord,
): Promise<VillageRecord> {
  const timers = await Promise.all(
    village.timers.map(async (timer) => {
      const notificationId = await scheduleTimerNotification({
        village,
        timer,
        mode: village.notificationMode,
      })

      return {
        ...timer,
        notificationId,
      }
    }),
  )

  return {
    ...village,
    timers,
  }
}

export async function rescheduleVillageNotifications(
  village: VillageRecord,
): Promise<VillageRecord> {
  await cancelVillageNotifications(village)

  const cleared: VillageRecord = {
    ...village,
    timers: village.timers.map((timer) => ({
      ...timer,
      notificationId: undefined,
    })),
  }

  return scheduleVillageNotifications(cleared)
}
```

---

# 11. App.tsx

```tsx
import type { NotificationMode, VillageRecord } from './src/types'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'

import {
  Alert,
  Button,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  createVillageFromExport,
  getActiveTimers,
  getDoneTimers,
  parseClashVillageExportText,
} from './src/clash/parseClashExport'
import { formatDateTime, formatDuration } from './src/clash/time'
import {
  cancelAllNotifications,
  cancelVillageNotifications,
  initNotifications,
  rescheduleVillageNotifications,
  scheduleVillageNotifications,
} from './src/notifications/notificationService'
import {
  clearVillages,
  loadVillages,
  removeVillage,
  saveVillages,
  updateVillage,
  upsertVillage,
} from './src/storage/villageStore'

const NOTIFICATION_MODE_LABEL: Record<NotificationMode, string> = {
  alarm: '闹钟提醒',
  notification: '普通通知',
  off: '关闭提醒',
}

const NOTIFICATION_MODE_DESC: Record<NotificationMode, string> = {
  alarm: '高优先级通知，声音和震动更明显',
  notification: '普通本地通知',
  off: '只显示倒计时，不设置提醒',
}

export default function App() {
  const [villages, setVillages] = useState<VillageRecord[]>([])
  const [selectedVillageId, setSelectedVillageId] = useState<string>()
  const [importText, setImportText] = useState('')
  const [defaultNotificationMode, setDefaultNotificationMode] =
    useState<NotificationMode>('alarm')
  const [now, setNow] = useState(Date.now())
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    initNotifications().catch(() => {
      Alert.alert('通知初始化失败', '请检查系统通知权限是否开启')
    })

    loadVillages()
      .then((storedVillages) => {
        setVillages(storedVillages)
        setSelectedVillageId(storedVillages[0]?.id)
      })
      .catch(() => {
        Alert.alert('读取失败', '本地村庄数据读取失败')
      })

    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [])

  const selectedVillage = useMemo(() => {
    return villages.find((village) => village.id === selectedVillageId)
  }, [selectedVillageId, villages])

  const selectedActiveTimers = useMemo(() => {
    if (!selectedVillage) {
      return []
    }

    return getActiveTimers(selectedVillage, now)
  }, [now, selectedVillage])

  const selectedDoneTimers = useMemo(() => {
    if (!selectedVillage) {
      return []
    }

    return getDoneTimers(selectedVillage, now)
  }, [now, selectedVillage])

  async function persist(nextVillages: VillageRecord[]) {
    setVillages(nextVillages)
    await saveVillages(nextVillages)
  }

  async function handleImportVillage() {
    if (isImporting) {
      return
    }

    setIsImporting(true)

    try {
      const exported = parseClashVillageExportText(importText)
      const incomingTag =
        typeof exported.tag === 'string'
          ? exported.tag.trim().toUpperCase()
          : undefined

      const existing = villages.find(
        (village) =>
          village.tag === incomingTag ||
          village.id === incomingTag ||
          village.tag.replace('#', '') === incomingTag?.replace('#', ''),
      )

      if (existing) {
        await cancelVillageNotifications(existing)
      }

      const village = createVillageFromExport(exported, {
        existing,
        notificationMode: defaultNotificationMode,
      })

      const scheduledVillage = await scheduleVillageNotifications(village)
      const nextVillages = upsertVillage(villages, scheduledVillage)

      await persist(nextVillages)

      setSelectedVillageId(scheduledVillage.id)
      setImportText('')

      Alert.alert(
        '导入成功',
        `${scheduledVillage.name} 已识别 ${scheduledVillage.timers.length} 个倒计时`,
      )
    } catch (error) {
      Alert.alert(
        '导入失败',
        error instanceof Error ? error.message : '未知错误',
      )
    } finally {
      setIsImporting(false)
    }
  }

  async function handleSelectVillage(village: VillageRecord) {
    setSelectedVillageId(village.id)
  }

  async function handleRenameVillage(village: VillageRecord) {
    Alert.prompt?.(
      '修改村庄名称',
      '请输入新的村庄名称',
      async (name) => {
        const nextName = name.trim()

        if (!nextName) {
          return
        }

        const nextVillages = updateVillage(villages, village.id, (item) => ({
          ...item,
          name: nextName,
          updatedAt: Date.now(),
        }))

        await persist(nextVillages)
      },
      'plain-text',
      village.name,
    )

    if (!Alert.prompt) {
      Alert.alert('当前平台不支持弹窗输入', '请后续改为自定义输入框')
    }
  }

  async function handleChangeVillageMode(
    village: VillageRecord,
    mode: NotificationMode,
  ) {
    const updated: VillageRecord = {
      ...village,
      notificationMode: mode,
      updatedAt: Date.now(),
    }

    const scheduled = await rescheduleVillageNotifications(updated)
    const nextVillages = updateVillage(villages, village.id, () => scheduled)

    await persist(nextVillages)
  }

  async function handleDeleteVillage(village: VillageRecord) {
    Alert.alert('删除村庄', `确定删除 ${village.name} 吗？`, [
      {
        text: '取消',
        style: 'cancel',
      },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await cancelVillageNotifications(village)

          const nextVillages = removeVillage(villages, village.id)

          await persist(nextVillages)
          setSelectedVillageId(nextVillages[0]?.id)
        },
      },
    ])
  }

  async function handleClearDoneTimers(village: VillageRecord) {
    const activeTimers = getActiveTimers(village, Date.now())

    const nextVillage: VillageRecord = {
      ...village,
      timers: activeTimers,
      updatedAt: Date.now(),
    }

    const nextVillages = updateVillage(villages, village.id, () => nextVillage)

    await persist(nextVillages)
  }

  async function handleClearAll() {
    Alert.alert(
      '清空全部数据',
      '会删除所有村庄并取消全部本地通知。确定继续？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            await cancelAllNotifications()
            await clearVillages()

            setVillages([])
            setSelectedVillageId(undefined)
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="auto" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Clash Helper</Text>
          <Text style={styles.subtitle}>
            粘贴部落冲突导出的村庄
            JSON，自动识别升级、研究、助手冷却和钟楼冷却。
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>默认提醒方式</Text>
          <ModeSelector
            value={defaultNotificationMode}
            onChange={setDefaultNotificationMode}
          />
          <Text style={styles.muted}>
            新导入村庄默认使用此模式；已有村庄会保留自己的提醒模式。
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>导入 / 更新村庄</Text>
          <TextInput
            value={importText}
            onChangeText={setImportText}
            multiline
            placeholder='粘贴游戏导出的 JSON，例如 {"tag":"#R2J0CRJYR",...}'
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Button
            title={isImporting ? '正在解析...' : '解析并保存'}
            disabled={isImporting}
            onPress={handleImportVillage}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>我的村庄</Text>
            {villages.length > 0 ? (
              <Pressable onPress={handleClearAll} style={styles.textButton}>
                <Text style={styles.dangerText}>清空</Text>
              </Pressable>
            ) : null}
          </View>

          {villages.length === 0 ? (
            <Text style={styles.muted}>还没有导入任何村庄。</Text>
          ) : (
            <View style={styles.villageList}>
              {villages.map((village) => {
                const activeCount = getActiveTimers(village, now).length
                const doneCount = getDoneTimers(village, now).length
                const active = village.id === selectedVillageId

                return (
                  <Pressable
                    key={village.id}
                    onPress={() => handleSelectVillage(village)}
                    style={[
                      styles.villageItem,
                      active && styles.villageItemActive,
                    ]}
                  >
                    <Text style={styles.villageName}>{village.name}</Text>
                    <Text style={styles.muted}>
                      {village.tag} · 进行中
                      {activeCount} · 已完成 {doneCount} ·{' '}
                      {NOTIFICATION_MODE_LABEL[village.notificationMode]}
                    </Text>
                    <Text style={styles.muted}>
                      最近导入：
                      {formatDateTime(village.importedAt)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>

        {selectedVillage ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.flex1}>
                <Text style={styles.cardTitle}>{selectedVillage.name}</Text>
                <Text style={styles.muted}>{selectedVillage.tag}</Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => handleRenameVillage(selectedVillage)}
                  style={styles.textButton}
                >
                  <Text style={styles.linkText}>改名</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleDeleteVillage(selectedVillage)}
                  style={styles.textButton}
                >
                  <Text style={styles.dangerText}>删除</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.sectionTitle}>提醒方式</Text>
            <ModeSelector
              value={selectedVillage.notificationMode}
              onChange={(mode) =>
                handleChangeVillageMode(selectedVillage, mode)
              }
            />

            <Text style={styles.sectionTitle}>进行中的倒计时</Text>
            {selectedActiveTimers.length === 0 ? (
              <Text style={styles.muted}>当前没有进行中的升级或冷却。</Text>
            ) : (
              <View style={styles.timerList}>
                {selectedActiveTimers.map((timer) => (
                  <TimerCard
                    key={timer.id}
                    timerTitle={timer.title}
                    sourceGroup={timer.sourceGroup}
                    endAt={timer.endAt}
                    now={now}
                    notificationEnabled={Boolean(timer.notificationId)}
                  />
                ))}
              </View>
            )}

            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>已完成</Text>
              {selectedDoneTimers.length > 0 ? (
                <Pressable
                  onPress={() => handleClearDoneTimers(selectedVillage)}
                  style={styles.textButton}
                >
                  <Text style={styles.linkText}>清理已完成</Text>
                </Pressable>
              ) : null}
            </View>

            {selectedDoneTimers.length === 0 ? (
              <Text style={styles.muted}>暂无已完成任务。</Text>
            ) : (
              <View style={styles.timerList}>
                {selectedDoneTimers.map((timer) => (
                  <TimerCard
                    key={timer.id}
                    timerTitle={timer.title}
                    sourceGroup={timer.sourceGroup}
                    endAt={timer.endAt}
                    now={now}
                    notificationEnabled={Boolean(timer.notificationId)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function ModeSelector(props: {
  value: NotificationMode
  onChange: (mode: NotificationMode) => void
}) {
  const modes: NotificationMode[] = ['alarm', 'notification', 'off']

  return (
    <View style={styles.modeList}>
      {modes.map((mode) => {
        const active = props.value === mode

        return (
          <Pressable
            key={mode}
            onPress={() => props.onChange(mode)}
            style={[styles.modeButton, active && styles.modeButtonActive]}
          >
            <Text style={active ? styles.modeTextActive : styles.modeText}>
              {NOTIFICATION_MODE_LABEL[mode]}
            </Text>
            <Text style={active ? styles.modeDescActive : styles.modeDesc}>
              {NOTIFICATION_MODE_DESC[mode]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function TimerCard(props: {
  timerTitle: string
  sourceGroup: string
  endAt: number
  now: number
  notificationEnabled: boolean
}) {
  const leftMs = props.endAt - props.now
  const done = leftMs <= 0

  return (
    <View style={[styles.timerItem, done && styles.timerDone]}>
      <Text style={styles.timerTitle}>{props.timerTitle}</Text>
      <Text style={done ? styles.doneText : styles.leftText}>
        {formatDuration(leftMs)}
      </Text>
      <Text style={styles.muted}>
        完成时间：
        {formatDateTime(props.endAt)}
      </Text>
      <Text style={styles.muted}>
        来源：
        {props.sourceGroup} ·{' '}
        {props.notificationEnabled ? '已设置提醒' : '未设置提醒'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
  },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '800',
    color: '#374151',
  },
  input: {
    minHeight: 180,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    color: '#111827',
    textAlignVertical: 'top',
    backgroundColor: '#f9fafb',
  },
  muted: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  dangerText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  modeList: {
    gap: 8,
  },
  modeButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  modeButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  modeText: {
    color: '#374151',
    fontWeight: '800',
  },
  modeTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  modeDesc: {
    marginTop: 2,
    color: '#6b7280',
    fontSize: 12,
  },
  modeDescActive: {
    marginTop: 2,
    color: '#1d4ed8',
    fontSize: 12,
  },
  villageList: {
    gap: 8,
  },
  villageItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 3,
  },
  villageItemActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  villageName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  timerList: {
    gap: 8,
  },
  timerItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  timerDone: {
    opacity: 0.62,
    backgroundColor: '#f9fafb',
  },
  timerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  leftText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16a34a',
  },
  doneText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#6b7280',
  },
})
```

---

# 12. **tests**/time.test.ts

```ts
import {
  formatDuration,
  normalizeTimestampSeconds,
  secondsToMs,
} from '../src/clash/time'

describe('time utilities', () => {
  it('normalizes seconds timestamp', () => {
    expect(normalizeTimestampSeconds(1781860781)).toBe(1781860781)
  })

  it('normalizes milliseconds timestamp', () => {
    expect(normalizeTimestampSeconds(1781860781000)).toBe(1781860781)
  })

  it('falls back when timestamp is invalid', () => {
    expect(normalizeTimestampSeconds(undefined, 1781860781000)).toBe(1781860781)
  })

  it('converts seconds to ms', () => {
    expect(secondsToMs(10)).toBe(10000)
  })

  it('formats duration', () => {
    expect(formatDuration(8163 * 1000)).toBe('2小时 16分钟')
    expect(formatDuration(61 * 1000)).toBe('1分钟 1秒')
    expect(formatDuration(0)).toBe('已完成')
  })
})
```

---

# 13. **tests**/parseClashExport.test.ts

```ts
import {
  createVillageFromExport,
  getActiveTimers,
  getDoneTimers,
  parseClashVillageExportText,
  parseTimersFromExport,
} from '../src/clash/parseClashExport'

const sample = {
  tag: '#R2J0CRJYR',
  timestamp: 1781860781,
  helpers: [{ data: 93000001, lvl: 1, helper_cooldown: 8426 }],
  buildings: [
    { data: 1000001, lvl: 9, timer: 88982 },
    { data: 1000006, lvl: 10, timer: 111356 },
    { data: 1000000, lvl: 2, cnt: 1 },
  ],
  spells: [
    {
      data: 26000010,
      lvl: 2,
      timer: 8163,
      helper_recurrent: true,
    },
  ],
  buildings2: [
    { data: 1000038, lvl: 5, timer: 70029 },
    { data: 1000036, lvl: 5, timer: 77663 },
  ],
  units2: [{ data: 4000037, lvl: 8, timer: 13990 }],
  boosts: {
    clocktower_cooldown: 53156,
  },
}

describe('parseClashExport', () => {
  it('parses json text', () => {
    const exported = parseClashVillageExportText(JSON.stringify(sample))

    expect(exported.tag).toBe('#R2J0CRJYR')
    expect(exported.timestamp).toBe(1781860781)
  })

  it('throws when json text is invalid', () => {
    expect(() => parseClashVillageExportText('{')).toThrow('JSON 格式不正确')
  })

  it('parses timers from all supported groups', () => {
    const timers = parseTimersFromExport(sample, '#R2J0CRJYR', 1781860781000)

    expect(timers).toHaveLength(8)

    expect(timers[0]).toMatchObject({
      villageId: '#R2J0CRJYR',
      sourceGroup: 'spells',
      scope: 'home',
      dataId: 26000010,
      level: 2,
      remainingSeconds: 8163,
      endAt: (1781860781 + 8163) * 1000,
    })

    expect(timers.some((timer) => timer.title === '夜世界钟楼冷却')).toBe(true)

    expect(timers.some((timer) => timer.sourceGroup === 'helpers')).toBe(true)
  })

  it('creates village record from export', () => {
    const village = createVillageFromExport(sample, {
      notificationMode: 'alarm',
      importedAt: 1781860781000,
    })

    expect(village.id).toBe('#R2J0CRJYR')
    expect(village.tag).toBe('#R2J0CRJYR')
    expect(village.name).toBe('#R2J0CRJYR')
    expect(village.notificationMode).toBe('alarm')
    expect(village.timers).toHaveLength(8)
  })

  it('preserves existing village name and notification mode', () => {
    const existing = createVillageFromExport(sample, {
      notificationMode: 'notification',
      importedAt: 1781860781000,
    })

    const updated = createVillageFromExport(sample, {
      existing: {
        ...existing,
        name: '我的大号',
        notificationMode: 'off',
      },
      notificationMode: 'alarm',
      importedAt: 1781860782000,
    })

    expect(updated.name).toBe('我的大号')
    expect(updated.notificationMode).toBe('off')
  })

  it('splits active and done timers', () => {
    const village = createVillageFromExport(sample, {
      importedAt: 1781860781000,
    })

    const nowBeforeAllDone = (1781860781 + 1) * 1000
    const nowAfterFirstDone = (1781860781 + 9000) * 1000

    expect(getActiveTimers(village, nowBeforeAllDone)).toHaveLength(8)
    expect(getDoneTimers(village, nowBeforeAllDone)).toHaveLength(0)

    expect(getDoneTimers(village, nowAfterFirstDone).length).toBeGreaterThan(0)
    expect(getActiveTimers(village, nowAfterFirstDone).length).toBeLessThan(8)
  })
})
```

---

# 14. 使用方式

```bash
pnpm install
pnpm check
pnpm android
```

导入你之前贴的 JSON 后，这版会识别类似：

```txt
主世界建筑 · #1000001 Lv.9
主世界建筑 · #1000006 Lv.10
主世界法术研究 · #26000010 Lv.2
夜世界建筑 · #1000038 Lv.5
夜世界建筑 · #1000036 Lv.5
夜世界兵种研究 · #4000037 Lv.8
助手冷却 · #93000001
夜世界钟楼冷却
```

同一个 `tag` 再导入时，会走覆盖更新：

```txt
取消旧通知
解析新 JSON
保留村庄昵称
保留村庄提醒模式
重新排期所有未完成通知
保存本地数据
```

---

# 15. 后续建议路线

```txt
Phase 1 当前这版：
本地多村庄 + JSON 解析 + 本地通知 + 提醒模式切换

Phase 2：
补 dataId 中文映射表
支持用户手动给未知 dataId 改名

Phase 3：
支持“建筑药水 / 研究药水 / 黄金令牌加速”手动校准

Phase 4：
做真正 Android AlarmManager 原生模块
支持跳系统 exact alarm 权限页
提升国产安卓后台可靠性

Phase 5：
再考虑服务端账号、云同步、Expo Push / FCM
```

你现在这个需求，**先不要上服务端推送**。一人用、本机提醒、本地导入，Expo 本地通知已经够跑 MVP。

[1]: https://github.com/baicie/clash-helper 'GitHub - baicie/clash-helper · GitHub'
[2]: https://docs.expo.dev/versions/latest/sdk/notifications/?utm_source=chatgpt.com 'Notifications - Expo Documentation'
[3]: https://developer.android.com/about/versions/14/changes/schedule-exact-alarms?utm_source=chatgpt.com 'Schedule exact alarms are denied by default'
