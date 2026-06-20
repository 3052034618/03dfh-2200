export type TempZoneType = 'frozen' | 'refrigerated' | 'constant';

export type CheckStatus = 'pending' | 'passed' | 'skipped' | 'failed';

export type InspectionItemKey = 'precooling' | 'probe' | 'seal' | 'fuel';

export interface Task {
  id: string;
  plateNumber: string;
  driverName: string;
  departureTime: string;
  destination: string;
  status: 'pending' | 'inspecting' | 'completed';
  tempZone: TempZoneType;
  waybillNo: string;
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
  plateNumber: string;
  completedItems: number;
  totalItems: number;
  skippedItems: InspectionItemKey[];
  status: 'pending' | 'in_progress' | 'completed';
  lastUpdateTime: number;
}

export interface TempZoneConfig {
  type: TempZoneType;
  label: string;
  color: string;
  bgColor: string;
  tempRange: string;
}
