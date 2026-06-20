import { Task, WaybillInfo, DriverInspectionStatus, InspectionRecord } from '@/types';
import dayjs from 'dayjs';

const createDepartureTimestamp = (timeStr: string): number => {
  const today = dayjs().format('YYYY-MM-DD');
  return dayjs(`${today} ${timeStr}`).valueOf();
};

export const MOCK_TASKS: Task[] = [
  {
    id: 'task001',
    plateNumber: '京A·88888',
    driverName: '张师傅',
    departureTime: '08:30',
    departureTimestamp: createDepartureTimestamp('08:30'),
    destination: '朝阳区超市配送中心',
    status: 'pending',
    tempZone: 'frozen',
    waybillNo: 'WB202406210001'
  },
  {
    id: 'task002',
    plateNumber: '京B·66666',
    driverName: '李师傅',
    departureTime: '09:00',
    departureTimestamp: createDepartureTimestamp('09:00'),
    destination: '海淀区生鲜仓库',
    status: 'pending',
    tempZone: 'refrigerated',
    waybillNo: 'WB202406210002'
  },
  {
    id: 'task003',
    plateNumber: '京C·99999',
    driverName: '王师傅',
    departureTime: '09:30',
    departureTimestamp: createDepartureTimestamp('09:30'),
    destination: '丰台区医药公司',
    status: 'pending',
    tempZone: 'constant',
    waybillNo: 'WB202406210003'
  },
  {
    id: 'task004',
    plateNumber: '京D·55555',
    driverName: '赵师傅',
    departureTime: '10:00',
    departureTimestamp: createDepartureTimestamp('10:00'),
    destination: '通州区冷链物流园',
    status: 'pending',
    tempZone: 'frozen',
    waybillNo: 'WB202406210004'
  },
  {
    id: 'task005',
    plateNumber: '京E·33333',
    driverName: '刘师傅',
    departureTime: '10:30',
    departureTimestamp: createDepartureTimestamp('10:30'),
    destination: '昌平区餐饮连锁总部',
    status: 'pending',
    tempZone: 'refrigerated',
    waybillNo: 'WB202406210005'
  },
  {
    id: 'task006',
    plateNumber: '京F·77777',
    driverName: '陈师傅',
    departureTime: '11:00',
    departureTimestamp: createDepartureTimestamp('11:00'),
    destination: '大兴区食品加工厂',
    status: 'pending',
    tempZone: 'frozen',
    waybillNo: 'WB202406210006'
  }
];

export const MOCK_WAYBILLS: Record<string, WaybillInfo> = {
  'WB202406210001': {
    waybillNo: 'WB202406210001',
    tempZone: 'frozen',
    goodsName: '冷冻水饺、汤圆',
    weight: '8.5吨',
    targetTemp: '≤-18℃'
  },
  'WB202406210002': {
    waybillNo: 'WB202406210002',
    tempZone: 'refrigerated',
    goodsName: '新鲜蔬菜、水果',
    weight: '6.2吨',
    targetTemp: '2-8℃'
  },
  'WB202406210003': {
    waybillNo: 'WB202406210003',
    tempZone: 'constant',
    goodsName: '医药试剂、生物制品',
    weight: '3.8吨',
    targetTemp: '15-25℃'
  },
  'WB202406210004': {
    waybillNo: 'WB202406210004',
    tempZone: 'frozen',
    goodsName: '冷冻肉类、海鲜',
    weight: '10.0吨',
    targetTemp: '≤-18℃'
  },
  'WB202406210005': {
    waybillNo: 'WB202406210005',
    tempZone: 'refrigerated',
    goodsName: '乳制品、豆制品',
    weight: '5.5吨',
    targetTemp: '2-8℃'
  },
  'WB202406210006': {
    waybillNo: 'WB202406210006',
    tempZone: 'frozen',
    goodsName: '冰淇淋、冷冻甜品',
    weight: '7.2吨',
    targetTemp: '≤-18℃'
  }
};

export const MOCK_DRIVER_STATUSES: DriverInspectionStatus[] = [
  {
    driverName: '张师傅',
    plateNumber: '京A·88888',
    departureTime: '08:30',
    departureTimestamp: createDepartureTimestamp('08:30'),
    completedItems: 4,
    totalItems: 4,
    skippedItems: [],
    failedItems: [],
    status: 'completed',
    lastUpdateTime: Date.now() - 300000,
    tempZone: 'frozen',
    waybillNo: 'WB202406210001'
  },
  {
    driverName: '李师傅',
    plateNumber: '京B·66666',
    departureTime: '09:00',
    departureTimestamp: createDepartureTimestamp('09:00'),
    completedItems: 2,
    totalItems: 4,
    skippedItems: ['probe'],
    failedItems: [],
    status: 'in_progress',
    lastUpdateTime: Date.now() - 120000,
    tempZone: 'refrigerated',
    waybillNo: 'WB202406210002'
  },
  {
    driverName: '王师傅',
    plateNumber: '京C·99999',
    departureTime: '09:30',
    departureTimestamp: createDepartureTimestamp('09:30'),
    completedItems: 0,
    totalItems: 4,
    skippedItems: [],
    failedItems: [],
    status: 'pending',
    lastUpdateTime: Date.now(),
    tempZone: 'constant',
    waybillNo: 'WB202406210003'
  },
  {
    driverName: '赵师傅',
    plateNumber: '京D·55555',
    departureTime: '10:00',
    departureTimestamp: createDepartureTimestamp('10:00'),
    completedItems: 3,
    totalItems: 4,
    skippedItems: [],
    failedItems: [],
    status: 'in_progress',
    lastUpdateTime: Date.now() - 60000,
    tempZone: 'frozen',
    waybillNo: 'WB202406210004'
  },
  {
    driverName: '刘师傅',
    plateNumber: '京E·33333',
    departureTime: '10:30',
    departureTimestamp: createDepartureTimestamp('10:30'),
    completedItems: 4,
    totalItems: 4,
    skippedItems: ['seal'],
    failedItems: [],
    status: 'completed',
    lastUpdateTime: Date.now() - 600000,
    tempZone: 'refrigerated',
    waybillNo: 'WB202406210005'
  },
  {
    driverName: '陈师傅',
    plateNumber: '京F·77777',
    departureTime: '11:00',
    departureTimestamp: createDepartureTimestamp('11:00'),
    completedItems: 1,
    totalItems: 4,
    skippedItems: [],
    failedItems: [],
    status: 'in_progress',
    lastUpdateTime: Date.now() - 180000,
    tempZone: 'frozen',
    waybillNo: 'WB202406210006'
  }
];

export const MOCK_INSPECTION_RECORDS: InspectionRecord[] = [];
