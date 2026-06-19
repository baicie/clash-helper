import type { NotificationMode, VillageRecord } from './src/types'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'

import {
  Alert,
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

export default function App() {
  const [villages, setVillages] = useState<VillageRecord[]>([])
  const [selectedVillageId, setSelectedVillageId] = useState<string>()
  const [importText, setImportText] = useState('')
  const [defaultNotificationMode, setDefaultNotificationMode] =
    useState<NotificationMode>('alarm')
  const [now, setNow] = useState(() => Date.now())
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
        try {
          await cancelVillageNotifications(existing)
        } catch {
          // 取消旧通知失败不影响新导入
        }
      }

      const village = createVillageFromExport(exported, {
        existing,
        notificationMode: defaultNotificationMode,
      })

      let scheduledVillage = village
      try {
        scheduledVillage = await scheduleVillageNotifications(village)
      } catch {
        // 通知排期失败不影响保存村庄数据
      }

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

    let scheduled = updated
    try {
      scheduled = await rescheduleVillageNotifications(updated)
    } catch {
      // 通知排期失败不影响模式切换
    }

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
          try {
            await cancelVillageNotifications(village)
          } catch {
            // ignore
          }

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
          <Pressable
            onPress={handleImportVillage}
            disabled={isImporting}
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
              {isImporting ? '正在解析...' : '解析并保存'}
            </Text>
          </Pressable>
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
                      {village.tag}
                      {' · 进行中 '}
                      {activeCount}
                      {' · 已完成 '}
                      {doneCount}
                      {' · '}
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
        {props.sourceGroup}
        {' · '}
        {props.notificationEnabled ? '已设置提醒' : '未设置提醒'}
      </Text>
    </View>
  )
}
