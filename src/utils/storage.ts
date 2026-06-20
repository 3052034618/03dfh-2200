import Taro from '@tarojs/taro';
import { InspectionRecord, DriverInspectionStatus } from '@/types';

const STORAGE_KEYS = {
  INSPECTION_RECORDS: 'inspection_records',
  DRIVER_STATUSES: 'driver_statuses',
  CURRENT_TASK: 'current_task'
};

export const storage = {
  getInspectionRecords: (): InspectionRecord[] => {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.INSPECTION_RECORDS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] Failed to get inspection records:', e);
      return [];
    }
  },

  saveInspectionRecord: (record: InspectionRecord): void => {
    try {
      const records = storage.getInspectionRecords();
      const existingIndex = records.findIndex(r => r.id === record.id);
      if (existingIndex >= 0) {
        records[existingIndex] = record;
      } else {
        records.unshift(record);
      }
      Taro.setStorageSync(STORAGE_KEYS.INSPECTION_RECORDS, JSON.stringify(records));
      console.log('[Storage] Inspection record saved:', record.id);
    } catch (e) {
      console.error('[Storage] Failed to save inspection record:', e);
    }
  },

  getDriverStatuses: (): DriverInspectionStatus[] => {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.DRIVER_STATUSES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] Failed to get driver statuses:', e);
      return [];
    }
  },

  saveDriverStatus: (status: DriverInspectionStatus): void => {
    try {
      const statuses = storage.getDriverStatuses();
      const existingIndex = statuses.findIndex(s => s.plateNumber === status.plateNumber);
      if (existingIndex >= 0) {
        statuses[existingIndex] = status;
      } else {
        statuses.push(status);
      }
      Taro.setStorageSync(STORAGE_KEYS.DRIVER_STATUSES, JSON.stringify(statuses));
      console.log('[Storage] Driver status saved:', status.plateNumber);
    } catch (e) {
      console.error('[Storage] Failed to save driver status:', e);
    }
  },

  setCurrentTask: (taskId: string | null): void => {
    try {
      Taro.setStorageSync(STORAGE_KEYS.CURRENT_TASK, taskId || '');
    } catch (e) {
      console.error('[Storage] Failed to set current task:', e);
    }
  },

  getCurrentTask: (): string | null => {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.CURRENT_TASK);
      return data || null;
    } catch (e) {
      console.error('[Storage] Failed to get current task:', e);
      return null;
    }
  },

  clearAll: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        Taro.removeStorageSync(key);
      });
      console.log('[Storage] All data cleared');
    } catch (e) {
      console.error('[Storage] Failed to clear data:', e);
    }
  }
};
