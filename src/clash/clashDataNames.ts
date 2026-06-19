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
