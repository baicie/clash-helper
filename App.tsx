import type {
  AppSettings,
  NotificationMode,
  VillageRecord,
  VillageTimer,
} from './src/types'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  LogBox,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  createVillageFromExport,
  getActiveTimers,
  getDoneTimers,
  getNextActiveTimer,
  parseClashVillageExportText,
} from './src/clash/parseClashExport'

import { formatDateTime, formatDuration } from './src/clash/time'
import {
  cancelAllNotifications,
  cancelVillageNotifications,
  initNotifications,
  rescheduleVillageNotifications,
  scheduleTestNotification,
  scheduleVillageNotifications,
} from './src/notifications/notificationService'
import { isInQuietHours, normalizeHour } from './src/settings/quietHours'
import {
  clearVillages,
  DEFAULT_APP_SETTINGS,
  loadSettings,
  loadVillages,
  removeVillage,
  saveSettings,
  saveVillages,
  updateVillage,
  upsertVillage,
} from './src/storage/villageStore'
import { stageSystemAlarmUpdate } from './src/system/alarmReconciliation'
import {
  openAutoStartSettings,
  openBatteryOptimizationSettings,
  openNotificationSettings,
} from './src/system/backgroundReliabilityService'
import {
  createSystemAlarm,
  createSystemAlarmBatch,
  createSystemCountdownTimer,
  dismissSystemAlarm,
  isSetAlarmPermissionError,
  openSystemAlarmApp,
} from './src/system/systemAlarmService'
import { APP_VERSION } from './src/version'

LogBox.ignoreLogs(['Cannot connect to Expo CLI'])

type AppView = 'home' | 'import' | 'settings' | 'test' | 'village'

const NOTIFICATION_MODE_LABEL: Record<NotificationMode, string> = {
  alarm: '闹钟提醒',
  countdown: '连续倒计时',
  notification: '普通通知',
  off: '关闭提醒',
}

const NOTIFICATION_MODE_DESC: Record<NotificationMode, string> = {
  alarm: '高优先级本地通知，声音和震动更明显',
  countdown: '自动选择最近项目，结束后切换下一个',
  notification: '普通本地通知',
  off: '只显示倒计时，不设置系统提醒',
}

interface RenameState {
  villageId: string
  value: string
}

interface MenuViewItem {
  key: AppView
  label: string
}

function parseReminderLeadMinutes(value: string) {
  const minutes = Number(value)

  if (!Number.isFinite(minutes) || minutes < 0) {
    return 0
  }

  return Math.floor(minutes)
}

function parseHourInput(value: string, fallback: number) {
  if (!value.trim()) {
    return fallback
  }

  return normalizeHour(Number(value), fallback)
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    fontSize: 22,
    color: '#111827',
    fontWeight: '900',
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
  },
  headerAction: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    color: '#2563eb',
    fontSize: 30,
    fontWeight: '500',
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
    height: 180,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    color: '#111827',
    textAlignVertical: 'top',
    backgroundColor: '#f9fafb',
  },
  compactInput: {
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  smallInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  importButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  importButtonTextDisabled: {
    color: '#dbeafe',
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
    flexWrap: 'wrap',
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  textButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  primaryText: {
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
  timerSummary: {
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
  timerControls: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 6,
  },
  continuousCountdown: {
    marginTop: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  continuousCountdownLabel: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
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
  outlineButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  outlineButtonText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  menuPanel: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 10,
  },
  menuItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
  },
  menuItemActive: {
    backgroundColor: '#eff6ff',
  },
  menuItemText: {
    color: '#111827',
    fontWeight: '800',
  },
  menuItemTextActive: {
    color: '#2563eb',
  },
})

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home')
  const [menuVisible, setMenuVisible] = useState(false)
  const [villages, setVillages] = useState<VillageRecord[]>([])
  const [selectedVillageId, setSelectedVillageId] = useState<string>()
  const [importText, setImportText] = useState('')
  const [defaultNotificationMode, setDefaultNotificationMode] =
    useState<NotificationMode>(DEFAULT_APP_SETTINGS.defaultNotificationMode)
  const [defaultReminderLeadMinutes, setDefaultReminderLeadMinutes] = useState(
    DEFAULT_APP_SETTINGS.defaultReminderLeadMinutes,
  )
  const [leadMinutesInput, setLeadMinutesInput] = useState(
    String(DEFAULT_APP_SETTINGS.defaultReminderLeadMinutes),
  )
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    DEFAULT_APP_SETTINGS.quietHoursEnabled,
  )
  const [quietHoursStartInput, setQuietHoursStartInput] = useState(
    String(DEFAULT_APP_SETTINGS.quietHoursStart),
  )
  const [quietHoursEndInput, setQuietHoursEndInput] = useState(
    String(DEFAULT_APP_SETTINGS.quietHoursEnd),
  )
  const [testNotificationMode, setTestNotificationMode] =
    useState<NotificationMode>('alarm')
  const [testSecondsInput, setTestSecondsInput] = useState('5')
  const [now, setNow] = useState(() => Date.now())
  const [isImporting, setIsImporting] = useState(false)
  const [updatingVillageId, setUpdatingVillageId] = useState<string>()
  const [renameState, setRenameState] = useState<RenameState | null>(null)
  const [expandedTimerId, setExpandedTimerId] = useState<string>()
  const startingSystemTimerRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    initNotifications().catch(() => {
      Alert.alert('通知初始化失败', '请检查系统通知权限是否开启')
    })

    Promise.all([loadVillages(), loadSettings()])
      .then(([storedVillages, settings]) => {
        setDefaultNotificationMode(settings.defaultNotificationMode)
        setDefaultReminderLeadMinutes(settings.defaultReminderLeadMinutes)
        setLeadMinutesInput(String(settings.defaultReminderLeadMinutes))
        setQuietHoursEnabled(settings.quietHoursEnabled)
        setQuietHoursStartInput(String(settings.quietHoursStart))
        setQuietHoursEndInput(String(settings.quietHoursEnd))
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

  const selectedNextTimer = useMemo(() => {
    if (!selectedVillage || selectedVillage.notificationMode !== 'countdown') {
      return undefined
    }

    return getNextActiveTimer(selectedVillage, now)
  }, [now, selectedVillage])
  const canSyncSystemAlarms =
    Platform.OS === 'android' &&
    (selectedActiveTimers.some((timer) => !timer.systemAlarmId) ||
      Boolean(selectedVillage?.pendingSystemAlarmCleanup?.length))
  const quietHoursSettings = {
    enabled: quietHoursEnabled,
    startHour: parseHourInput(
      quietHoursStartInput,
      DEFAULT_APP_SETTINGS.quietHoursStart,
    ),
    endHour: parseHourInput(
      quietHoursEndInput,
      DEFAULT_APP_SETTINGS.quietHoursEnd,
    ),
  }
  function getSettings(overrides: Partial<AppSettings> = {}): AppSettings {
    return {
      defaultNotificationMode,
      defaultReminderLeadMinutes,
      quietHoursEnabled,
      quietHoursStart: quietHoursSettings.startHour,
      quietHoursEnd: quietHoursSettings.endHour,
      ...overrides,
    }
  }

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !selectedVillage ||
      selectedVillage.notificationMode !== 'countdown' ||
      !selectedNextTimer ||
      selectedNextTimer.systemTimerId
    ) {
      return
    }

    const startKey = `${selectedVillage.id}:${selectedNextTimer.id}`

    if (startingSystemTimerRef.current === startKey) {
      return
    }

    startingSystemTimerRef.current = startKey

    createSystemCountdownTimer({
      message: `${selectedVillage.name}：${selectedNextTimer.title}`,
      endAt: selectedNextTimer.endAt,
      skipUi: true,
    })
      .then((systemTimerId) => {
        setVillages((currentVillages) => {
          const nextVillages = updateVillage(
            currentVillages,
            selectedVillage.id,
            (village) => ({
              ...village,
              updatedAt: Date.now(),
              timers: village.timers.map((timer) =>
                timer.id === selectedNextTimer.id
                  ? {
                      ...timer,
                      systemTimerId,
                      systemTimerStartedAt: Date.now(),
                    }
                  : timer,
              ),
            }),
          )

          saveVillages(nextVillages).catch(() => undefined)
          return nextVillages
        })
      })
      .catch((error: unknown) => {
        Alert.alert(
          '连续倒计时启动失败',
          error instanceof Error ? error.message : '未知错误',
        )
      })
      .finally(() => {
        if (startingSystemTimerRef.current === startKey) {
          startingSystemTimerRef.current = undefined
        }
      })
  }, [selectedNextTimer, selectedVillage])

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
      const rawIncomingTag =
        typeof exported.tag === 'string'
          ? exported.tag.trim().toUpperCase()
          : undefined
      const incomingTag = rawIncomingTag
        ? rawIncomingTag.startsWith('#')
          ? rawIncomingTag
          : `#${rawIncomingTag}`
        : undefined
      const updateTarget = updatingVillageId
        ? villages.find((village) => village.id === updatingVillageId)
        : undefined
      const matchedExisting = villages.find(
        (village) => village.tag === incomingTag || village.id === incomingTag,
      )

      if (updatingVillageId && !updateTarget) {
        throw new Error('要更新的村庄不存在，请返回首页重试')
      }

      if (updateTarget && updateTarget.tag !== incomingTag) {
        throw new Error(
          `JSON 属于 ${incomingTag ?? '未知村庄'}，当前要更新的是 ${updateTarget.tag}`,
        )
      }

      if (!updateTarget && matchedExisting) {
        Alert.alert(
          '村庄已存在',
          `请进入 ${matchedExisting.name}，点击右上角“更新”后再粘贴 JSON。`,
        )
        return
      }

      const existing = updateTarget

      if (existing) {
        try {
          await cancelVillageNotifications(existing)
        } catch {
          // ignore
        }
      }

      const village = createVillageFromExport(exported, {
        existing,
        notificationMode: defaultNotificationMode,
        defaultReminderLeadMinutes,
      })

      let stagedVillage = village
      let alarmPlan: ReturnType<typeof stageSystemAlarmUpdate>['plan'] | null =
        null

      if (existing) {
        const staged = stageSystemAlarmUpdate({
          existing,
          updated: village,
          quietHours: quietHoursSettings,
        })
        stagedVillage = staged.village
        alarmPlan = staged.plan
      }

      let scheduledVillage = stagedVillage

      try {
        scheduledVillage = await scheduleVillageNotifications(stagedVillage)
      } catch {
        // 通知失败不影响导入
      }

      const nextVillages = upsertVillage(villages, scheduledVillage)

      await persist(nextVillages)

      setSelectedVillageId(scheduledVillage.id)
      setCurrentView('village')
      setUpdatingVillageId(undefined)
      setImportText('')

      Alert.alert(
        existing ? '更新成功' : '导入成功',
        existing && alarmPlan
          ? `${scheduledVillage.name} 已更新：待清理旧闹钟 ${alarmPlan.alarmsToDismiss.length} 个，待创建新闹钟 ${alarmPlan.alarmsToCreate.length} 个，休息时段跳过 ${alarmPlan.quietHoursSkipped} 个。请在村庄页面点击“同步系统闹钟”。`
          : `${scheduledVillage.name} 已识别 ${scheduledVillage.timers.length} 个倒计时`,
      )
    } catch (error) {
      Alert.alert(
        updatingVillageId ? '更新失败' : '导入失败',
        error instanceof Error ? error.message : '未知错误',
      )
    } finally {
      setIsImporting(false)
    }
  }

  function handleOpenNewVillageImport() {
    setUpdatingVillageId(undefined)
    setImportText('')
    setCurrentView('import')
  }

  function handleOpenVillageUpdate(village: VillageRecord) {
    setSelectedVillageId(village.id)
    setUpdatingVillageId(village.id)
    setImportText('')
    setCurrentView('import')
  }

  function handleBack() {
    if (currentView === 'import' && updatingVillageId) {
      setUpdatingVillageId(undefined)
      setCurrentView('village')
      return
    }

    setUpdatingVillageId(undefined)
    setCurrentView('home')
  }

  function handleOpenRenameVillage(village: VillageRecord) {
    setRenameState({
      villageId: village.id,
      value: village.name,
    })
  }

  async function handleConfirmRenameVillage() {
    if (!renameState) {
      return
    }

    const nextName = renameState.value.trim()

    if (!nextName) {
      Alert.alert('名称不能为空')
      return
    }

    const nextVillages = updateVillage(
      villages,
      renameState.villageId,
      (item) => ({
        ...item,
        name: nextName,
        updatedAt: Date.now(),
      }),
    )

    await persist(nextVillages)
    setRenameState(null)
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

    let scheduled = updated

    try {
      scheduled = await rescheduleVillageNotifications(updated)
    } catch {
      // ignore
    }

    const nextVillages = updateVillage(villages, village.id, () => scheduled)

    await persist(nextVillages)
  }

  async function handleChangeDefaultNotificationMode(mode: NotificationMode) {
    setDefaultNotificationMode(mode)
    await saveSettings(getSettings({ defaultNotificationMode: mode }))
  }

  async function handleApplyDefaultReminderLeadMinutes() {
    const nextLeadMinutes = parseReminderLeadMinutes(leadMinutesInput)

    setDefaultReminderLeadMinutes(nextLeadMinutes)
    setLeadMinutesInput(String(nextLeadMinutes))
    await saveSettings(
      getSettings({ defaultReminderLeadMinutes: nextLeadMinutes }),
    )

    const updatedVillages = villages.map((village) => ({
      ...village,
      defaultReminderLeadMinutes: nextLeadMinutes,
      updatedAt: Date.now(),
      timers: village.timers.map((timer) => ({
        ...timer,
        reminderLeadMinutes: nextLeadMinutes,
      })),
    }))

    const scheduledVillages = await Promise.all(
      updatedVillages.map(async (village) => {
        try {
          return await rescheduleVillageNotifications(village)
        } catch {
          return village
        }
      }),
    )

    await persist(scheduledVillages)
    Alert.alert('设置已保存', `全部提醒会提前 ${nextLeadMinutes} 分钟触发`)
  }

  async function handleChangeTimerReminderLead(
    village: VillageRecord,
    timer: VillageTimer,
    value: string,
  ) {
    const nextLeadMinutes = parseReminderLeadMinutes(value)
    const updatedVillage: VillageRecord = {
      ...village,
      updatedAt: Date.now(),
      timers: village.timers.map((current) =>
        current.id === timer.id
          ? {
              ...current,
              reminderLeadMinutes: nextLeadMinutes,
            }
          : current,
      ),
    }

    let scheduledVillage = updatedVillage

    try {
      scheduledVillage = await rescheduleVillageNotifications(updatedVillage)
    } catch {
      // 通知重排失败不影响提前量保存。
    }

    const nextVillages = updateVillage(
      villages,
      village.id,
      () => scheduledVillage,
    )

    await persist(nextVillages)
  }

  async function handleRunTestNotification() {
    if (testNotificationMode === 'off') {
      Alert.alert('关闭提醒模式', '该模式不会发送系统通知')
      return
    }

    try {
      const seconds = parseReminderLeadMinutes(testSecondsInput) || 5

      if (testNotificationMode === 'alarm' && Platform.OS === 'android') {
        await createSystemAlarm({
          message: 'Clash Helper 闹钟测试',
          endAt: Date.now() + seconds * 1000,
          skipUi: true,
        })

        Alert.alert('闹钟测试已创建', '系统闹钟已自动添加')
        return
      }

      await initNotifications()
      await scheduleTestNotification({
        mode: testNotificationMode,
        seconds,
      })

      Alert.alert('通知测试已创建', '请等待系统通知弹出')
    } catch (error) {
      if (isSetAlarmPermissionError(error)) {
        try {
          await openSystemAlarmApp()
        } catch {
          // ignore
        }

        Alert.alert(
          '需要开发构建',
          'Expo Go 没有创建系统闹钟的权限，已为你打开系统时钟。开发构建或正式安装包可以直接创建。',
        )
        return
      }

      Alert.alert(
        '测试提醒失败',
        error instanceof Error ? error.message : '未知错误',
      )
    }
  }

  async function handleDeleteVillage(village: VillageRecord) {
    Alert.alert(
      '删除村庄',
      `确定删除 ${village.name} 吗？已创建的系统闹钟需在时钟应用中单独删除。`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelVillageNotifications(village)
            } catch {
              // ignore
            }

            const nextVillages = removeVillage(villages, village.id)

            await persist(nextVillages)
            setSelectedVillageId(nextVillages[0]?.id)
            setCurrentView('home')
          },
        },
      ],
    )
  }

  async function handleClearDoneTimers(village: VillageRecord) {
    const activeTimers = getActiveTimers(village, Date.now())
    const expiredAlarmCount = village.timers.filter(
      (timer) => timer.endAt <= Date.now() && timer.systemAlarmId,
    ).length

    const nextVillage: VillageRecord = {
      ...village,
      timers: activeTimers,
      updatedAt: Date.now(),
    }

    const nextVillages = updateVillage(villages, village.id, () => nextVillage)

    await persist(nextVillages)

    if (expiredAlarmCount > 0) {
      Alert.alert(
        '已清理完成项目',
        `同时清理了 ${expiredAlarmCount} 条应用闹钟记录。系统时钟中的已停用闹钟需在时钟应用内删除。`,
        [
          { text: '完成' },
          {
            text: '打开系统时钟',
            onPress: () => {
              openSystemAlarmApp().catch(() => undefined)
            },
          },
        ],
      )
    }
  }

  async function handleClearAll() {
    Alert.alert(
      '清空全部数据',
      '会删除所有村庄并取消本地通知。系统时钟中的闹钟仍需手动删除。确定继续？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAllNotifications()
            } catch {
              // ignore
            }

            try {
              await clearVillages()
            } catch {
              // ignore
            }

            setVillages([])
            setSelectedVillageId(undefined)
            setCurrentView('home')
          },
        },
      ],
    )
  }

  async function handleCreateSystemAlarm(
    village: VillageRecord,
    timer: VillageTimer,
  ) {
    if (isInQuietHours(timer.endAt, quietHoursSettings)) {
      Alert.alert('已跳过休息时段', '该项目完成时间位于休息时段，不创建闹钟')
      return
    }

    try {
      const systemAlarmId = await createSystemAlarm({
        message: `${village.name}：${timer.title} 已完成`,
        endAt: timer.endAt,
        skipUi: true,
      })

      const nextVillages = updateVillage(villages, village.id, (item) => ({
        ...item,
        updatedAt: Date.now(),
        timers: item.timers.map((current) =>
          current.id === timer.id
            ? {
                ...current,
                systemAlarmId,
                systemAlarmCreatedAt: Date.now(),
              }
            : current,
        ),
      }))

      await persist(nextVillages)

      Alert.alert('已创建系统闹钟', '请在系统时钟中确认闹钟时间和铃声。')
    } catch (error) {
      if (isSetAlarmPermissionError(error)) {
        try {
          await openSystemAlarmApp()
        } catch {
          // ignore
        }

        Alert.alert(
          '需要开发构建',
          'Expo Go 没有创建系统闹钟的权限，已为你打开系统时钟。开发构建或正式安装包可以直接创建。',
        )
        return
      }

      Alert.alert(
        '创建系统闹钟失败',
        error instanceof Error ? error.message : '未知错误',
      )
    }
  }

  async function handleCreateAllSystemAlarms(village: VillageRecord) {
    const pendingCleanup = village.pendingSystemAlarmCleanup ?? []
    const activeTimers = getActiveTimers(village, Date.now()).filter(
      (timer) => !timer.systemAlarmId,
    )

    if (activeTimers.length === 0 && pendingCleanup.length === 0) {
      Alert.alert('无需同步', '当前没有待清理或待创建的系统闹钟')
      return
    }

    const eligibleTimers = activeTimers.filter(
      (timer) => !isInQuietHours(timer.endAt, quietHoursSettings),
    )
    const quietHoursSkipped = activeTimers.length - eligibleTimers.length

    let dismissed = 0
    const failedCleanup: typeof pendingCleanup = []

    for (const pending of pendingCleanup) {
      try {
        await dismissSystemAlarm(pending.endAt, Platform.OS, pending.title)
        dismissed += 1
      } catch {
        failedCleanup.push(pending)
      }
    }

    let createdByTimerId = new Map<string, string>()
    let created = 0
    let deferred = 0
    let createFailed = 0
    let creationError: unknown

    try {
      if (eligibleTimers.length > 0) {
        const result = await createSystemAlarmBatch(
          eligibleTimers.map((timer) => ({
            id: timer.id,
            message: timer.title,
            endAt: timer.endAt,
            skipUi: true,
          })),
        )
        createdByTimerId = new Map(
          result.created.map((item) => [item.id, item.systemAlarmId]),
        )
        created = result.created.length
        deferred = result.deferred.length
        createFailed = result.failed.length
      }
    } catch (error) {
      creationError = error
      createFailed = eligibleTimers.length
    }

    const syncedAt = Date.now()
    const nextVillages = updateVillage(villages, village.id, (item) => ({
      ...item,
      updatedAt: syncedAt,
      systemAlarmSyncEnabled: true,
      pendingSystemAlarmCleanup:
        failedCleanup.length > 0 ? failedCleanup : undefined,
      timers: item.timers.map((timer) => {
        const systemAlarmId = createdByTimerId.get(timer.id)

        return systemAlarmId
          ? { ...timer, systemAlarmId, systemAlarmCreatedAt: syncedAt }
          : timer
      }),
    }))

    await persist(nextVillages)

    if (creationError && isSetAlarmPermissionError(creationError)) {
      Alert.alert(
        '需要开发构建',
        'Expo Go 没有批量创建系统闹钟的权限，请使用开发构建或正式安装包。',
      )
      return
    }

    Alert.alert(
      '系统闹钟同步完成',
      `已清理 ${dismissed} 个，已创建 ${created} 个，等待进入24小时 ${deferred} 个，休息时段跳过 ${quietHoursSkipped} 个，失败 ${failedCleanup.length + createFailed} 个`,
    )
  }

  async function handleSaveQuietHours() {
    const quietHoursStart = quietHoursSettings.startHour
    const quietHoursEnd = quietHoursSettings.endHour

    setQuietHoursStartInput(String(quietHoursStart))
    setQuietHoursEndInput(String(quietHoursEnd))
    await saveSettings(getSettings({ quietHoursStart, quietHoursEnd }))
    Alert.alert(
      '休息时段已保存',
      `${quietHoursStart}:00–${quietHoursEnd}:00 不创建系统闹钟`,
    )
  }

  async function handleToggleQuietHours(enabled: boolean) {
    setQuietHoursEnabled(enabled)
    await saveSettings(getSettings({ quietHoursEnabled: enabled }))
  }

  async function handleClearExpiredAlarmRecords(village: VillageRecord) {
    const expiredAlarmCount = village.timers.filter(
      (timer) => timer.systemAlarmId && timer.endAt <= Date.now(),
    ).length

    if (expiredAlarmCount === 0) {
      Alert.alert('无需清理', '当前没有已响过的闹钟记录')
      return
    }

    const nextVillages = updateVillage(villages, village.id, (item) => ({
      ...item,
      updatedAt: Date.now(),
      timers: item.timers.map((timer) =>
        timer.systemAlarmId && timer.endAt <= Date.now()
          ? {
              ...timer,
              systemAlarmId: undefined,
              systemAlarmCreatedAt: undefined,
            }
          : timer,
      ),
    }))

    await persist(nextVillages)
    Alert.alert(
      '已清理闹钟记录',
      `已清理 ${expiredAlarmCount} 条应用记录。系统时钟中的已停用闹钟需在时钟应用内删除。`,
      [
        { text: '完成' },
        {
          text: '打开系统时钟',
          onPress: () => {
            openSystemAlarmApp().catch(() => undefined)
          },
        },
      ],
    )
  }

  async function handleOpenSystemSetting(
    title: string,
    action: () => Promise<void>,
  ) {
    try {
      await action()
    } catch (error) {
      Alert.alert(
        `${title}打开失败`,
        error instanceof Error ? error.message : '无法打开系统设置',
      )
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="auto" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable
              testID={currentView === 'home' ? 'menu-button' : 'back-button'}
              onPress={() =>
                currentView === 'home' ? setMenuVisible(true) : handleBack()
              }
              style={styles.menuButton}
            >
              <Text style={styles.menuButtonText}>
                {currentView === 'home' ? '☰' : '‹'}
              </Text>
            </Pressable>
            <Text style={styles.title}>Clash Helper</Text>
            {currentView === 'home' ? (
              <Pressable
                testID="add-village-button"
                onPress={handleOpenNewVillageImport}
                style={styles.headerAction}
              >
                <Text style={styles.headerActionText}>+</Text>
              </Pressable>
            ) : null}
          </View>
          {currentView === 'import' ? (
            <Text style={styles.subtitle}>
              {updatingVillageId
                ? `更新${selectedVillage?.name ?? ''}`
                : '导入新村庄'}
            </Text>
          ) : null}
        </View>

        {currentView === 'home' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>我的村庄</Text>
            {villages.length === 0 ? (
              <Text style={styles.muted}>还没有导入任何村庄。</Text>
            ) : (
              <View style={styles.villageList}>
                {villages.map((village) => {
                  const activeCount = getActiveTimers(village, now).length
                  const doneCount = getDoneTimers(village, now).length

                  return (
                    <Pressable
                      key={village.id}
                      testID={`village-item-${village.id}`}
                      onPress={() => {
                        setSelectedVillageId(village.id)
                        setCurrentView('village')
                      }}
                      style={styles.villageItem}
                    >
                      <Text style={styles.villageName}>{village.name}</Text>
                      <Text style={styles.muted}>
                        {village.tag} · 进行中 {activeCount} · 已完成{' '}
                        {doneCount} ·{' '}
                        {NOTIFICATION_MODE_LABEL[village.notificationMode]}
                      </Text>
                      <Text style={styles.muted}>
                        最近导入：{formatDateTime(village.importedAt)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>
        ) : null}

        {currentView === 'import' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {updatingVillageId
                ? `更新${selectedVillage?.name ?? '村庄'}`
                : '导入新村庄'}
            </Text>
            <TextInput
              testID="import-textarea"
              value={importText}
              onChangeText={setImportText}
              multiline
              scrollEnabled
              placeholder='粘贴游戏导出的 JSON，例如 {"tag":"#R2J0CRJYR",...}'
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              testID="import-button"
              disabled={isImporting}
              onPress={handleImportVillage}
              style={[
                styles.importButton,
                isImporting && styles.importButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.importButtonText,
                  isImporting && styles.importButtonTextDisabled,
                ]}
              >
                {isImporting
                  ? '正在解析...'
                  : updatingVillageId
                    ? '更新并同步闹钟'
                    : '导入村庄'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {currentView === 'village' ? (
          selectedVillage ? (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flex1}>
                  <Text style={styles.cardTitle}>{selectedVillage.name}</Text>
                  <Text style={styles.muted}>{selectedVillage.tag}</Text>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    testID="update-village-button"
                    onPress={() => handleOpenVillageUpdate(selectedVillage)}
                    style={styles.textButton}
                  >
                    <Text style={styles.primaryText}>更新</Text>
                  </Pressable>

                  <Pressable
                    testID="rename-village-button"
                    onPress={() => handleOpenRenameVillage(selectedVillage)}
                    style={styles.textButton}
                  >
                    <Text style={styles.primaryText}>改名</Text>
                  </Pressable>

                  <Pressable
                    testID="delete-village-button"
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
              {selectedVillage.pendingSystemAlarmCleanup?.length ? (
                <Text style={styles.muted}>
                  待清理旧闹钟{' '}
                  {selectedVillage.pendingSystemAlarmCleanup.length} 个
                </Text>
              ) : null}

              {Platform.OS === 'android' ? (
                <View style={styles.actionRow}>
                  {canSyncSystemAlarms ? (
                    <Pressable
                      testID="create-all-system-alarms-button"
                      onPress={() =>
                        handleCreateAllSystemAlarms(selectedVillage)
                      }
                      style={styles.outlineButton}
                    >
                      <Text style={styles.outlineButtonText}>同步系统闹钟</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    testID="clear-expired-alarms-button"
                    onPress={() =>
                      handleClearExpiredAlarmRecords(selectedVillage)
                    }
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>清理已响闹钟</Text>
                  </Pressable>
                </View>
              ) : null}

              {selectedNextTimer ? (
                <View
                  testID="continuous-countdown"
                  style={styles.continuousCountdown}
                >
                  <Text style={styles.continuousCountdownLabel}>
                    连续倒计时 · 当前项目
                  </Text>
                  <Text style={styles.timerTitle}>
                    {selectedNextTimer.title}
                  </Text>
                  <Text style={styles.leftText}>
                    {formatDuration(selectedNextTimer.endAt - now)}
                  </Text>
                  <Text style={styles.muted}>
                    剩余 {selectedActiveTimers.length} 个项目
                  </Text>
                  <Text style={styles.muted}>
                    {selectedNextTimer.systemTimerId
                      ? '系统倒计时已启动'
                      : '正在启动系统倒计时'}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>进行中的倒计时</Text>
              {selectedActiveTimers.length === 0 ? (
                <Text style={styles.muted}>当前没有进行中的升级或冷却。</Text>
              ) : (
                <View style={styles.timerList}>
                  {selectedActiveTimers.map((timer) => (
                    <TimerCard
                      key={timer.id}
                      timer={timer}
                      now={now}
                      expanded={expandedTimerId === timer.id}
                      onToggleSettings={() =>
                        setExpandedTimerId((current) =>
                          current === timer.id ? undefined : timer.id,
                        )
                      }
                      onChangeReminderLead={(value) =>
                        handleChangeTimerReminderLead(
                          selectedVillage,
                          timer,
                          value,
                        )
                      }
                      onCreateSystemAlarm={
                        Platform.OS === 'android'
                          ? () =>
                              handleCreateSystemAlarm(selectedVillage, timer)
                          : undefined
                      }
                    />
                  ))}
                </View>
              )}

              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>已完成</Text>
                {selectedDoneTimers.length > 0 ? (
                  <Pressable
                    testID="clear-done-button"
                    onPress={() => handleClearDoneTimers(selectedVillage)}
                    style={styles.textButton}
                  >
                    <Text style={styles.primaryText}>清理已完成</Text>
                  </Pressable>
                ) : null}
              </View>

              {selectedDoneTimers.length === 0 ? (
                <Text style={styles.muted}>暂无已完成任务。</Text>
              ) : (
                <View style={styles.timerList}>
                  {selectedDoneTimers.map((timer) => (
                    <TimerCard key={timer.id} timer={timer} now={now} />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.muted}>村庄不存在或已被删除。</Text>
            </View>
          )
        ) : null}

        {currentView === 'settings' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>设置</Text>
            <Text style={styles.sectionTitle}>默认提醒方式</Text>
            <ModeSelector
              value={defaultNotificationMode}
              onChange={handleChangeDefaultNotificationMode}
            />
            <Text style={styles.muted}>新导入村庄默认使用此提醒方式。</Text>

            <Text style={styles.sectionTitle}>统一提前提醒</Text>
            <View style={styles.inputRow}>
              <TextInput
                testID="default-lead-minutes-input"
                value={leadMinutesInput}
                onChangeText={setLeadMinutesInput}
                keyboardType="number-pad"
                style={styles.compactInput}
              />
              <Text style={styles.muted}>分钟</Text>
              <Pressable
                testID="apply-default-lead-minutes-button"
                onPress={handleApplyDefaultReminderLeadMinutes}
                style={styles.outlineButton}
              >
                <Text style={styles.outlineButtonText}>应用到全部</Text>
              </Pressable>
            </View>
            <Text style={styles.muted}>
              当前默认提前 {defaultReminderLeadMinutes}{' '}
              分钟；新导入村庄会使用这个值。
            </Text>

            <View style={styles.rowBetween}>
              <View style={styles.flex1}>
                <Text style={styles.sectionTitle}>智能跳过休息时段</Text>
                <Text style={styles.muted}>休息时段内不创建系统闹钟</Text>
              </View>
              <Switch
                testID="quiet-hours-switch"
                value={quietHoursEnabled}
                onValueChange={handleToggleQuietHours}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                testID="quiet-hours-start-input"
                value={quietHoursStartInput}
                onChangeText={setQuietHoursStartInput}
                keyboardType="number-pad"
                maxLength={2}
                style={styles.compactInput}
              />
              <Text style={styles.muted}>:00 至</Text>
              <TextInput
                testID="quiet-hours-end-input"
                value={quietHoursEndInput}
                onChangeText={setQuietHoursEndInput}
                keyboardType="number-pad"
                maxLength={2}
                style={styles.compactInput}
              />
              <Text style={styles.muted}>:00</Text>
              <Pressable
                testID="save-quiet-hours-button"
                onPress={handleSaveQuietHours}
                style={styles.outlineButton}
              >
                <Text style={styles.outlineButtonText}>保存时段</Text>
              </Pressable>
            </View>

            {Platform.OS === 'android' ? (
              <>
                <Text style={styles.sectionTitle}>后台可靠性</Text>
                <Text style={styles.muted}>
                  {Platform.constants.Manufacturer} {Platform.constants.Model}
                </Text>
                <View style={styles.actionRow}>
                  <Pressable
                    testID="open-auto-start-settings-button"
                    onPress={() =>
                      handleOpenSystemSetting(
                        '自启动设置',
                        openAutoStartSettings,
                      )
                    }
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>后台与自启动</Text>
                  </Pressable>
                  <Pressable
                    testID="open-battery-settings-button"
                    onPress={() =>
                      handleOpenSystemSetting(
                        '电池优化设置',
                        openBatteryOptimizationSettings,
                      )
                    }
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>电池优化</Text>
                  </Pressable>
                  <Pressable
                    testID="open-notification-settings-button"
                    onPress={() =>
                      handleOpenSystemSetting(
                        '通知设置',
                        openNotificationSettings,
                      )
                    }
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>通知权限</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>数据</Text>
            <Pressable
              testID="clear-all-button"
              onPress={handleClearAll}
              style={styles.outlineButton}
            >
              <Text style={styles.dangerText}>清空全部村庄</Text>
            </Pressable>

            <Text style={styles.muted}>Clash Helper {APP_VERSION}</Text>
          </View>
        ) : null}

        {currentView === 'test' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>测试提醒</Text>
            <ModeSelector
              value={testNotificationMode}
              onChange={setTestNotificationMode}
            />
            <Text style={styles.sectionTitle}>触发时间</Text>
            <View style={styles.inputRow}>
              <TextInput
                testID="test-seconds-input"
                value={testSecondsInput}
                onChangeText={setTestSecondsInput}
                keyboardType="number-pad"
                style={styles.compactInput}
              />
              <Text style={styles.muted}>秒后</Text>
              <Pressable
                testID="run-test-notification-button"
                onPress={handleRunTestNotification}
                style={styles.outlineButton}
              >
                <Text style={styles.outlineButtonText}>发送测试</Text>
              </Pressable>
            </View>
            <Text style={styles.muted}>
              可用来确认普通通知、闹钟提醒和权限是否正常。
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <MenuModal
        visible={menuVisible}
        currentView={currentView}
        villages={villages}
        selectedVillageId={selectedVillageId}
        onClose={() => setMenuVisible(false)}
        onSelectView={(view) => {
          setCurrentView(view)
          setMenuVisible(false)
        }}
        onSelectVillage={(villageId) => {
          setSelectedVillageId(villageId)
          setCurrentView('village')
          setMenuVisible(false)
        }}
      />

      <RenameModal
        state={renameState}
        onChangeValue={(value) =>
          setRenameState((current) =>
            current
              ? {
                  ...current,
                  value,
                }
              : current,
          )
        }
        onCancel={() => setRenameState(null)}
        onConfirm={handleConfirmRenameVillage}
      />
    </SafeAreaView>
  )
}

function ModeSelector(props: {
  value: NotificationMode
  onChange: (mode: NotificationMode) => void
}) {
  const modes: NotificationMode[] = [
    'alarm',
    'countdown',
    'notification',
    'off',
  ]

  return (
    <View style={styles.modeList}>
      {modes.map((mode) => {
        const active = props.value === mode

        return (
          <Pressable
            key={mode}
            testID={`mode-${mode}`}
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
  timer: VillageTimer
  now: number
  expanded?: boolean
  onToggleSettings?: () => void
  onChangeReminderLead?: (value: string) => void
  onCreateSystemAlarm?: () => void
}) {
  const leftMs = props.timer.endAt - props.now
  const done = leftMs <= 0
  const summary = (
    <>
      <Text style={styles.timerTitle}>{props.timer.title}</Text>
      <Text style={done ? styles.doneText : styles.leftText}>
        {formatDuration(leftMs)}
      </Text>
      <Text style={styles.muted}>
        完成时间：{formatDateTime(props.timer.endAt)}
      </Text>
      <Text style={styles.muted}>
        来源：{props.timer.sourceGroup} ·{' '}
        {props.timer.notificationId ? '已设置本地提醒' : '未设置本地提醒'}
      </Text>
      {!done && props.onChangeReminderLead ? (
        <Text style={styles.primaryText}>
          {props.expanded ? '收起项目设置' : '展开项目设置'}
        </Text>
      ) : null}
    </>
  )

  return (
    <View style={[styles.timerItem, done && styles.timerDone]}>
      {!done && props.onToggleSettings ? (
        <Pressable
          testID={`timer-summary-${props.timer.id}`}
          onPress={props.onToggleSettings}
          style={styles.timerSummary}
        >
          {summary}
        </Pressable>
      ) : (
        <View style={styles.timerSummary}>{summary}</View>
      )}
      {!done && props.expanded && props.onChangeReminderLead ? (
        <View style={styles.timerControls}>
          <Text style={styles.muted}>提前提醒</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID={`timer-lead-minutes-input-${props.timer.id}`}
              defaultValue={String(props.timer.reminderLeadMinutes ?? 0)}
              keyboardType="number-pad"
              onEndEditing={(event) =>
                props.onChangeReminderLead?.(event.nativeEvent.text)
              }
              style={styles.compactInput}
            />
            <Text style={styles.muted}>分钟</Text>
          </View>
          {props.timer.systemAlarmId ? (
            <Text style={styles.muted}>已创建系统闹钟</Text>
          ) : null}
          {props.onCreateSystemAlarm ? (
            <Pressable
              testID={`system-alarm-button-${props.timer.id}`}
              onPress={props.onCreateSystemAlarm}
              style={styles.outlineButton}
            >
              <Text style={styles.outlineButtonText}>创建系统闹钟</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!done && !props.expanded && props.timer.systemAlarmId ? (
        <Text style={styles.muted}>已创建系统闹钟</Text>
      ) : null}
    </View>
  )
}

function MenuModal(props: {
  visible: boolean
  currentView: AppView
  villages: VillageRecord[]
  selectedVillageId?: string
  onClose: () => void
  onSelectView: (view: AppView) => void
  onSelectVillage: (villageId: string) => void
}) {
  const views: MenuViewItem[] = [
    { key: 'home', label: '主页' },
    { key: 'settings', label: '设置' },
    { key: 'test', label: '测试提醒' },
  ]

  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <Pressable style={styles.modalBackdrop} onPress={props.onClose}>
        <Pressable style={styles.menuPanel}>
          <Text style={styles.cardTitle}>菜单</Text>

          {views.map((view) => {
            const active = props.currentView === view.key

            return (
              <Pressable
                key={view.key}
                testID={`menu-view-${view.key}`}
                onPress={() => props.onSelectView(view.key)}
                style={[styles.menuItem, active && styles.menuItemActive]}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    active && styles.menuItemTextActive,
                  ]}
                >
                  {view.label}
                </Text>
              </Pressable>
            )
          })}

          <Text style={styles.sectionTitle}>切换村庄</Text>
          {props.villages.length === 0 ? (
            <Text style={styles.muted}>还没有村庄</Text>
          ) : (
            props.villages.map((village) => {
              const active = props.selectedVillageId === village.id

              return (
                <Pressable
                  key={village.id}
                  testID={`menu-village-${village.id}`}
                  onPress={() => props.onSelectVillage(village.id)}
                  style={[styles.menuItem, active && styles.menuItemActive]}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      active && styles.menuItemTextActive,
                    ]}
                  >
                    {village.name}
                  </Text>
                  <Text style={styles.muted}>{village.tag}</Text>
                </Pressable>
              )
            })
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function RenameModal(props: {
  state: RenameState | null
  onChangeValue: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal visible={Boolean(props.state)} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.cardTitle}>修改村庄名称</Text>
          <TextInput
            testID="rename-input"
            value={props.state?.value ?? ''}
            onChangeText={props.onChangeValue}
            placeholder="请输入村庄名称"
            style={styles.smallInput}
          />
          <View style={styles.rowBetween}>
            <Pressable
              testID="rename-cancel-button"
              onPress={props.onCancel}
              style={styles.textButton}
            >
              <Text style={styles.dangerText}>取消</Text>
            </Pressable>
            <Pressable
              testID="rename-confirm-button"
              onPress={props.onConfirm}
              style={styles.textButton}
            >
              <Text style={styles.primaryText}>保存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
