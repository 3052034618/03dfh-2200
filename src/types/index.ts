export type TempZoneType = 'frozen' | 'refrigerated' | 'constant';

export type CheckStatus = 'pending' | 'passed' | 'skipped' | 'failed';

export type InspectionItemKey = 'precooling' | 'probe' | 'seal' | 'fuel';

export interface Task {
  id: string;
  plateNumber: string;
  driverName: string;
  originalDriverName?: string;
  departureTime: string;
  departureTimestamp: number;
  destination: string;
  status: 'pending' | 'inspecting' | 'completed';
  tempZone: TempZoneType;
  waybillNo: string;
  isRelief?: boolean;
}

export interface InspectionItem {
  key: InspectionItemKey;
  title: string;
  description: string;
  exampleImage: string;
  requiresPhoto: boolean;
  checkMethod: string;
  standard: string;
}

export interface InspectionRecord {
  id: string;
  taskId: string;
  plateNumber: string;
  driverName: string;
  originalDriverName?: string;
  inspectorName?: string;
  departureTime: string;
  waybillNo: string;
  items: Record<InspectionItemKey, {
    status: CheckStatus;
    photo?: string;
    remark?: string;
    checkedAt: number;
  }>;
  currentTemp: number;
  tempZone: TempZoneType;
  isTempMatch: boolean;
  completedAt?: number;
  createdAt: number;
}

export interface WaybillInfo {
  waybillNo: string;
  tempZone: TempZoneType;
  goodsName: string;
  weight: string;
  targetTemp: string;
}

export interface DriverInspectionStatus {
  driverName: string;
  originalDriverName?: string;
  inspectorName?: string;
  plateNumber: string;
  departureTime: string;
  departureTimestamp: number;
  completedItems: number;
  totalItems: number;
  skippedItems: InspectionItemKey[];
  failedItems: InspectionItemKey[];
  status: 'pending' | 'in_progress' | 'completed';
  lastUpdateTime: number;
  recordId?: string;
  isRelief?: boolean;
  tempZone?: TempZoneType;
  currentTemp?: number;
  waybillNo?: string;
}

export interface TempZoneConfig {
  type: TempZoneType;
  label: string;
  color: string;
  bgColor: string;
  tempRange: string;
}
