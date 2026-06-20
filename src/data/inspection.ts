import { InspectionItem, TempZoneConfig, InspectionItemKey } from '@/types';

export const INSPECTION_ITEMS: InspectionItem[] = [
  {
    key: 'precooling',
    title: '车厢预冷温度',
    description: '检查车厢内部温度是否达到预设温区标准',
    exampleImage: 'https://picsum.photos/id/119/600/400',
    requiresPhoto: true,
    checkMethod: '使用车内温控面板查看当前温度，或使用手持测温枪多点测量',
    standard: '冷冻区≤-18℃，冷藏区2-8℃，恒温区15-25℃'
  },
  {
    key: 'probe',
    title: '温度探头在线状态',
    description: '确认温度监控探头连接正常，数据实时上传',
    exampleImage: 'https://picsum.photos/id/201/600/400',
    requiresPhoto: true,
    checkMethod: '查看温控显示屏，确认所有探头图标显示在线，无离线告警',
    standard: '全部探头在线，温度数据每30秒更新一次'
  },
  {
    key: 'seal',
    title: '门帘和密封条',
    description: '检查车厢门帘、密封条是否完好，无破损脱落',
    exampleImage: 'https://picsum.photos/id/160/600/400',
    requiresPhoto: true,
    checkMethod: '绕车检查所有车门密封条，开关门测试门帘垂落情况',
    standard: '密封条无破损、无脱落，门帘完整垂落，关闭后无缝隙'
  },
  {
    key: 'fuel',
    title: '制冷机油量/电量',
    description: '检查制冷机组燃油量或电池电量，确保全程制冷',
    exampleImage: 'https://picsum.photos/id/3/600/400',
    requiresPhoto: true,
    checkMethod: '查看制冷机组控制面板，确认燃油表/电量指示',
    standard: '油量≥50%或电量≥60%，预估续航≥2倍运输里程'
  }
];

export const INSPECTION_ITEM_KEYS: InspectionItemKey[] = ['precooling', 'probe', 'seal', 'fuel'];

export const TEMP_ZONE_CONFIGS: TempZoneConfig[] = [
  {
    type: 'frozen',
    label: '冷冻',
    color: '#2979FF',
    bgColor: 'rgba(41, 121, 255, 0.1)',
    tempRange: '≤-18℃'
  },
  {
    type: 'refrigerated',
    label: '冷藏',
    color: '#00BFA5',
    bgColor: 'rgba(0, 191, 165, 0.1)',
    tempRange: '2-8℃'
  },
  {
    type: 'constant',
    label: '恒温',
    color: '#FFAB00',
    bgColor: 'rgba(255, 171, 0, 0.1)',
    tempRange: '15-25℃'
  }
];

export const getTempZoneConfig = (type: string): TempZoneConfig => {
  return TEMP_ZONE_CONFIGS.find(c => c.type === type) || TEMP_ZONE_CONFIGS[1];
};

export const checkTempMatch = (currentTemp: number, tempZone: string): boolean => {
  switch (tempZone) {
    case 'frozen':
      return currentTemp <= -18;
    case 'refrigerated':
      return currentTemp >= 2 && currentTemp <= 8;
    case 'constant':
      return currentTemp >= 15 && currentTemp <= 25;
    default:
      return false;
  }
};
