export interface ClashDataNameMeta {
  en: string
  zh: string
  kind:
    | 'building'
    | 'trap'
    | 'hero'
    | 'troop'
    | 'spell'
    | 'siege'
    | 'pet'
    | 'equipment'
    | 'builder-building'
    | 'builder-trap'
    | 'builder-troop'
    | 'helper'
}

export const CLASH_DATA_NAMES: Record<number, ClashDataNameMeta> = {
  1000097: { en: 'Crafted Defense', zh: '合成防御', kind: 'building' },
  1000008: { en: 'Cannon', zh: '加农炮', kind: 'building' },
  1000009: { en: 'Archer Tower', zh: '箭塔', kind: 'building' },
  1000013: { en: 'Mortar', zh: '迫击炮', kind: 'building' },
  1000012: { en: 'Air Defense', zh: '防空火箭', kind: 'building' },
  1000011: { en: 'Wizard Tower', zh: '法师塔', kind: 'building' },
  1000028: { en: 'Air Sweeper', zh: '空气炮', kind: 'building' },
  1000019: { en: 'Hidden Tesla', zh: '特斯拉电磁塔', kind: 'building' },
  1000032: { en: 'Bomb Tower', zh: '炸弹塔', kind: 'building' },
  1000021: { en: 'X-Bow', zh: 'X 连弩', kind: 'building' },
  1000027: { en: 'Inferno Tower', zh: '地狱塔', kind: 'building' },
  1000031: { en: 'Eagle Artillery', zh: '天鹰火炮', kind: 'building' },
  1000067: { en: 'Scattershot', zh: '投石炮', kind: 'building' },
  1000015: { en: 'Builders Hut', zh: '建筑工人小屋', kind: 'building' },
  1000072: { en: 'Spell Tower', zh: '法术塔', kind: 'building' },
  1000077: { en: 'Monolith', zh: '巨石碑', kind: 'building' },
  1000089: { en: 'Firespitter', zh: '火焰喷射器', kind: 'building' },
  1000010: { en: 'Wall', zh: '城墙', kind: 'building' },
  1000084: { en: 'Multi-Archer Tower', zh: '多重箭塔', kind: 'building' },
  1000085: { en: 'Ricochet Cannon', zh: '弹射加农炮', kind: 'building' },
  1000079: { en: 'Multi-Gear Tower', zh: '多重齿轮塔', kind: 'building' },

  12000000: { en: 'Bomb', zh: '炸弹', kind: 'trap' },
  12000001: { en: 'Spring Trap', zh: '弹簧陷阱', kind: 'trap' },
  12000002: { en: 'Giant Bomb', zh: '巨型炸弹', kind: 'trap' },
  12000005: { en: 'Air Bomb', zh: '空中炸弹', kind: 'trap' },
  12000006: { en: 'Seeking Air Mine', zh: '搜空地雷', kind: 'trap' },
  12000008: { en: 'Skeleton Trap', zh: '骷髅陷阱', kind: 'trap' },
  12000016: { en: 'Tornado Trap', zh: '飓风陷阱', kind: 'trap' },
  12000020: { en: 'Giga Bomb', zh: '巨型爆弹', kind: 'trap' },

  1000004: { en: 'Gold Mine', zh: '金矿', kind: 'building' },
  1000002: { en: 'Elixir Collector', zh: '圣水收集器', kind: 'building' },
  1000005: { en: 'Gold Storage', zh: '金库', kind: 'building' },
  1000003: { en: 'Elixir Storage', zh: '圣水瓶', kind: 'building' },
  1000023: { en: 'Dark Elixir Drill', zh: '暗黑重油钻井', kind: 'building' },
  1000024: { en: 'Dark Elixir Storage', zh: '暗黑重油罐', kind: 'building' },
  1000014: { en: 'Clan Castle', zh: '部落城堡', kind: 'building' },
  1000000: { en: 'Army Camp', zh: '兵营营地', kind: 'building' },
  1000006: { en: 'Barracks', zh: '训练营', kind: 'building' },
  1000026: { en: 'Dark Barracks', zh: '暗黑训练营', kind: 'building' },
  1000007: { en: 'Laboratory', zh: '实验室', kind: 'building' },
  1000020: { en: 'Spell Factory', zh: '法术工厂', kind: 'building' },
  1000071: { en: 'Hero Hall', zh: '英雄殿堂', kind: 'building' },
  1000029: { en: 'Dark Spell Factory', zh: '暗黑法术工厂', kind: 'building' },
  1000070: { en: 'Blacksmith', zh: '铁匠铺', kind: 'building' },
  1000059: { en: 'Workshop', zh: '攻城机器工坊', kind: 'building' },
  1000068: { en: 'Pet House', zh: '战宠小屋', kind: 'building' },
  1000001: { en: 'Town Hall', zh: '大本营', kind: 'building' },

  28000000: { en: 'Barbarian King', zh: '野蛮人之王', kind: 'hero' },
  28000001: { en: 'Archer Queen', zh: '弓箭女皇', kind: 'hero' },
  28000006: { en: 'Minion Prince', zh: '亡灵王子', kind: 'hero' },
  28000002: { en: 'Grand Warden', zh: '大守护者', kind: 'hero' },
  28000004: { en: 'Royal Champion', zh: '飞盾战神', kind: 'hero' },

  4000051: { en: 'Wall Wrecker', zh: '攻城战车', kind: 'siege' },
  4000052: { en: 'Battle Blimp', zh: '攻城飞艇', kind: 'siege' },
  4000062: { en: 'Stone Slammer', zh: '攻城气球', kind: 'siege' },
  4000075: { en: 'Siege Barracks', zh: '攻城训练营', kind: 'siege' },
  4000087: { en: 'Log Launcher', zh: '滚木攻城车', kind: 'siege' },
  4000091: { en: 'Flame Flinger', zh: '烈焰投石车', kind: 'siege' },
  4000092: { en: 'Battle Drill', zh: '攻城钻机', kind: 'siege' },
  4000135: { en: 'Troop Launcher', zh: '投兵器', kind: 'siege' },

  73000000: { en: 'L.A.S.S.I', zh: '莱希', kind: 'pet' },
  73000001: { en: 'Electro Owl', zh: '闪枭', kind: 'pet' },
  73000002: { en: 'Mighty Yak', zh: '大牦', kind: 'pet' },
  73000003: { en: 'Unicorn', zh: '独角', kind: 'pet' },
  73000004: { en: 'Phoenix', zh: '凤凰', kind: 'pet' },
  73000007: { en: 'Poison Lizard', zh: '毒蜥', kind: 'pet' },
  73000008: { en: 'Diggy', zh: '掘地鼠', kind: 'pet' },
  73000009: { en: 'Frosty', zh: '冰牙', kind: 'pet' },
  73000010: { en: 'Spirit Fox', zh: '灵狐', kind: 'pet' },
  73000011: { en: 'Angry Jelly', zh: '愤怒胶冻', kind: 'pet' },
  73000016: { en: 'Sneezy', zh: '喷喷', kind: 'pet' },

  4000000: { en: 'Barbarian', zh: '野蛮人', kind: 'troop' },
  4000001: { en: 'Archer', zh: '弓箭手', kind: 'troop' },
  4000002: { en: 'Goblin', zh: '哥布林', kind: 'troop' },
  4000003: { en: 'Giant', zh: '巨人', kind: 'troop' },
  4000004: { en: 'Wall Breaker', zh: '炸弹人', kind: 'troop' },
  4000005: { en: 'Balloon', zh: '气球兵', kind: 'troop' },
  4000006: { en: 'Wizard', zh: '法师', kind: 'troop' },
  4000007: { en: 'Healer', zh: '天使', kind: 'troop' },
  4000008: { en: 'Dragon', zh: '飞龙', kind: 'troop' },
  4000009: { en: 'P.E.K.K.A', zh: '皮卡超人', kind: 'troop' },
  4000010: { en: 'Minion', zh: '亡灵', kind: 'troop' },
  4000011: { en: 'Hog Rider', zh: '野猪骑士', kind: 'troop' },
  4000012: { en: 'Valkyrie', zh: '女武神', kind: 'troop' },
  4000013: { en: 'Golem', zh: '戈仑石人', kind: 'troop' },
  4000015: { en: 'Witch', zh: '女巫', kind: 'troop' },
  4000017: { en: 'Lava Hound', zh: '熔岩猎犬', kind: 'troop' },
  4000022: { en: 'Bowler', zh: '巨石投手', kind: 'troop' },
  4000023: { en: 'Baby Dragon', zh: '飞龙宝宝', kind: 'troop' },
  4000024: { en: 'Miner', zh: '掘地矿工', kind: 'troop' },
  4000053: { en: 'Yeti', zh: '雪怪', kind: 'troop' },
  4000058: { en: 'Ice Golem', zh: '戈仑冰人', kind: 'troop' },
  4000059: { en: 'Electro Dragon', zh: '雷电飞龙', kind: 'troop' },
  4000065: { en: 'Dragon Rider', zh: '龙骑士', kind: 'troop' },
  4000082: { en: 'Headhunter', zh: '猎手', kind: 'troop' },
  4000095: { en: 'Electro Titan', zh: '雷电泰坦', kind: 'troop' },
  4000097: { en: 'Apprentice Warden', zh: '学徒守护者', kind: 'troop' },
  4000110: { en: 'Root Rider', zh: '掘地骑士', kind: 'troop' },
  4000123: { en: 'Druid', zh: '德鲁伊', kind: 'troop' },
  4000132: { en: 'Thrower', zh: '投矛手', kind: 'troop' },
  4000150: { en: 'Furnace', zh: '熔炉', kind: 'troop' },

  26000000: { en: 'Lightning Spell', zh: '雷电法术', kind: 'spell' },
  26000001: { en: 'Healing Spell', zh: '治疗法术', kind: 'spell' },
  26000002: { en: 'Rage Spell', zh: '狂暴法术', kind: 'spell' },
  26000003: { en: 'Jump Spell', zh: '弹跳法术', kind: 'spell' },
  26000005: { en: 'Freeze Spell', zh: '冰冻法术', kind: 'spell' },
  26000009: { en: 'Poison Spell', zh: '毒药法术', kind: 'spell' },
  26000010: { en: 'Earthquake Spell', zh: '地震法术', kind: 'spell' },
  26000011: { en: 'Haste Spell', zh: '急速法术', kind: 'spell' },
  26000016: { en: 'Clone Spell', zh: '复制法术', kind: 'spell' },
  26000017: { en: 'Skeleton Spell', zh: '骷髅法术', kind: 'spell' },
  26000028: { en: 'Bat Spell', zh: '蝙蝠法术', kind: 'spell' },
  26000035: { en: 'Invisibility Spell', zh: '隐形法术', kind: 'spell' },
  26000053: { en: 'Recall Spell', zh: '召回法术', kind: 'spell' },
  26000070: { en: 'Overgrowth Spell', zh: '蔓生法术', kind: 'spell' },
  26000098: { en: 'Revive Spell', zh: '复苏法术', kind: 'spell' },
  26000109: { en: 'Ice Block Spell', zh: '冰块法术', kind: 'spell' },

  4000031: { en: 'Raged Barbarian', zh: '狂暴野蛮人', kind: 'builder-troop' },
  4000032: { en: 'Sneaky Archer', zh: '隐秘弓箭手', kind: 'builder-troop' },
  4000033: { en: 'Boxer Giant', zh: '拳击巨人', kind: 'builder-troop' },
  4000034: { en: 'Beta Minion', zh: '异变亡灵', kind: 'builder-troop' },
  4000035: { en: 'Bomber', zh: '炸弹兵', kind: 'builder-troop' },
  4000037: { en: 'Cannon Cart', zh: '加农炮战车', kind: 'builder-troop' },
  4000041: { en: 'Night Witch', zh: '暗夜女巫', kind: 'builder-troop' },
  4000042: { en: 'Drop Ship', zh: '骷髅气球', kind: 'builder-troop' },

  1000038: { en: 'Double Cannon', zh: '双管加农炮', kind: 'builder-building' },
  1000036: { en: 'Archer Tower', zh: '夜世界箭塔', kind: 'builder-building' },

  93000001: { en: 'Helper', zh: '助手', kind: 'helper' },
}

export function getClashDataMeta(dataId: number | undefined) {
  if (typeof dataId !== 'number') {
    return undefined
  }

  return CLASH_DATA_NAMES[dataId]
}

export function getClashDataName(dataId: number | undefined) {
  return getClashDataMeta(dataId)?.zh
}

export function formatClashDataId(dataId: number | undefined) {
  if (typeof dataId !== 'number') {
    return '未知 ID'
  }

  const meta = getClashDataMeta(dataId)

  if (!meta) {
    return `#${dataId}`
  }

  return `${meta.zh} #${dataId}`
}
