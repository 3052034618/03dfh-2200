import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { InspectionRecord, InspectionItemKey, CheckStatus, Task, TempZoneType, ReviewStatus } from '@/types';
import { INSPECTION_ITEM_KEYS, checkTempMatch } from '@/data/inspection';
import { storage } from '@/utils/storage';

interface InspectionState {
  currentTask: Task | null;
  currentRecord: InspectionRecord | null;
  currentTemp: number;
  inspectorName: string | null;
  isReliefInspection: boolean;
  fromMatching: boolean;
  matchingWaybillTemp: number;
  matchingWaybillNo: string | null;
  matchingTempZone: TempZoneType | null;
  matchingVerified: boolean;
  matchingGoodsName: string | null;
  matchingTargetTemp: string | null;
}

type InspectionAction =
  | { type: 'SET_TASK'; payload: Task }
  | { type: 'SET_TEMP'; payload: number }
  | { type: 'SET_INSPECTOR'; payload: string | null }
  | { type: 'SET_RELIEF_MODE'; payload: boolean }
  | { type: 'SET_FROM_MATCHING'; payload: boolean }
  | { type: 'SET_MATCHING_DATA'; payload: { temp: number; waybillNo: string; tempZone: TempZoneType; verified: boolean; goodsName?: string; targetTemp?: string } }
  | { type: 'UPDATE_ITEM'; payload: { key: InspectionItemKey; status: CheckStatus; photo?: string; remark?: string } }
  | { type: 'COMPLETE_INSPECTION' }
  | { type: 'RESET' }
  | { type: 'LOAD_RECORD'; payload: InspectionRecord };

const initialState: InspectionState = {
  currentTask: null,
  currentRecord: null,
  currentTemp: 0,
  inspectorName: null,
  isReliefInspection: false,
  fromMatching: false,
  matchingWaybillTemp: 0,
  matchingWaybillNo: null,
  matchingTempZone: null,
  matchingVerified: false,
  matchingGoodsName: null,
  matchingTargetTemp: null
};

const createEmptyRecord = (task: Task, inspectorName?: string | null, isRelief?: boolean): InspectionRecord => {
  const now = Date.now();
  const items = {} as InspectionRecord['items'];
  INSPECTION_ITEM_KEYS.forEach(key => {
    items[key] = {
      status: 'pending',
      checkedAt: now
    };
  });
  const effectiveOriginalDriver = task.originalDriverName || task.driverName;
  const effectiveInspector = inspectorName || task.inspectorName;
  return {
    id: `REC_${now}`,
    taskId: task.id,
    plateNumber: task.plateNumber,
    driverName: effectiveOriginalDriver,
    originalDriverName: isRelief || task.isRelief ? effectiveOriginalDriver : undefined,
    inspectorName: (isRelief || task.isRelief) ? effectiveInspector : undefined,
    departureTime: task.departureTime,
    waybillNo: task.waybillNo,
    items,
    currentTemp: 0,
    tempZone: task.tempZone,
    isTempMatch: false,
    createdAt: now
  };
};

const inspectionReducer = (state: InspectionState, action: InspectionAction): InspectionState => {
  switch (action.type) {
    case 'SET_TASK': {
      const record = createEmptyRecord(action.payload, state.inspectorName, state.isReliefInspection);
      const tempToUse = state.fromMatching && state.matchingWaybillTemp !== 0 ? state.matchingWaybillTemp : state.currentTemp;
      record.currentTemp = tempToUse;
      if (tempToUse !== 0) {
        record.isTempMatch = checkTempMatch(tempToUse, action.payload.tempZone);
      }
      if (state.fromMatching) {
        record.matchingWaybillNo = state.matchingWaybillNo || undefined;
        record.matchingTemp = state.matchingWaybillTemp || undefined;
        record.matchingVerified = state.matchingVerified || undefined;
        record.goodsName = state.matchingGoodsName || undefined;
        record.targetTemp = state.matchingTargetTemp || undefined;
      }
      storage.setCurrentTask(action.payload.id);
      return {
        ...state,
        currentTask: action.payload,
        currentRecord: record,
        currentTemp: tempToUse
      };
    }
    case 'SET_TEMP': {
      if (!state.currentRecord) return state;
      const isMatch = state.currentTask ? checkTempMatch(action.payload, state.currentTask.tempZone) : false;
      const newRecord = {
        ...state.currentRecord,
        currentTemp: action.payload,
        isTempMatch: isMatch
      };
      storage.saveInspectionRecord(newRecord);
      return {
        ...state,
        currentTemp: action.payload,
        currentRecord: newRecord
      };
    }
    case 'SET_INSPECTOR': {
      return {
        ...state,
        inspectorName: action.payload,
        isReliefInspection: !!action.payload
      };
    }
    case 'SET_RELIEF_MODE': {
      return {
        ...state,
        isReliefInspection: action.payload
      };
    }
    case 'SET_FROM_MATCHING': {
      return {
        ...state,
        fromMatching: action.payload
      };
    }
    case 'SET_MATCHING_DATA': {
      return {
        ...state,
        fromMatching: true,
        matchingWaybillTemp: action.payload.temp,
        matchingWaybillNo: action.payload.waybillNo,
        matchingTempZone: action.payload.tempZone,
        matchingVerified: action.payload.verified,
        matchingGoodsName: action.payload.goodsName || null,
        matchingTargetTemp: action.payload.targetTemp || null,
        currentTemp: action.payload.temp
      };
    }
    case 'UPDATE_ITEM': {
      if (!state.currentRecord) return state;
      const { key, status, photo, remark } = action.payload;
      const effectiveOriginal = state.currentRecord.originalDriverName || state.currentTask?.originalDriverName || state.currentTask?.driverName;
      const effectiveInspector = state.inspectorName || state.currentTask?.inspectorName || state.currentRecord.inspectorName;
      const newRecord = {
        ...state.currentRecord,
        driverName: effectiveOriginal || state.currentRecord.driverName,
        originalDriverName: (state.isReliefInspection || state.currentTask?.isRelief) ? effectiveOriginal : state.currentRecord.originalDriverName,
        inspectorName: (state.isReliefInspection || state.currentTask?.isRelief) ? effectiveInspector : state.currentRecord.inspectorName,
        items: {
          ...state.currentRecord.items,
          [key]: {
            ...state.currentRecord.items[key],
            status,
            photo: photo || state.currentRecord.items[key].photo,
            remark: remark || state.currentRecord.items[key].remark,
            checkedAt: Date.now()
          }
        }
      };
      storage.saveInspectionRecord(newRecord);
      return {
        ...state,
        currentRecord: newRecord
      };
    }
    case 'COMPLETE_INSPECTION': {
      if (!state.currentRecord || !state.currentTask) return state;
      const effectiveOriginal = state.currentRecord.originalDriverName || state.currentTask.originalDriverName || state.currentTask.driverName;
      const effectiveInspector = state.inspectorName || state.currentTask.inspectorName || state.currentRecord.inspectorName;
      const isRelief = state.isReliefInspection || state.currentTask.isRelief;
      const now = Date.now();

      const skippedKeys = INSPECTION_ITEM_KEYS.filter(k => state.currentRecord!.items[k].status === 'skipped');
      const failedKeys = INSPECTION_ITEM_KEYS.filter(k => state.currentRecord!.items[k].status === 'failed');
      const hasSkipped = skippedKeys.length > 0;
      const hasFailed = failedKeys.length > 0;
      let autoReviewStatus: ReviewStatus | undefined;
      if (hasSkipped || hasFailed) {
        autoReviewStatus = 'pending_contact';
      }

      const newRecord: InspectionRecord = {
        ...state.currentRecord,
        driverName: effectiveOriginal || state.currentRecord.driverName,
        originalDriverName: isRelief ? effectiveOriginal : state.currentRecord.originalDriverName,
        inspectorName: isRelief ? effectiveInspector : state.currentRecord.inspectorName,
        completedAt: now,
        reviewStatus: autoReviewStatus || state.currentRecord.reviewStatus,
        contactLog: state.currentRecord.contactLog || []
      };
      storage.saveInspectionRecord(newRecord);
      
      storage.saveDriverStatus({
        driverName: effectiveOriginal || state.currentTask.driverName,
        originalDriverName: isRelief ? effectiveOriginal : undefined,
        inspectorName: isRelief ? effectiveInspector : undefined,
        plateNumber: state.currentTask.plateNumber,
        departureTime: state.currentTask.departureTime,
        departureTimestamp: state.currentTask.departureTimestamp,
        completedItems: INSPECTION_ITEM_KEYS.filter(k => newRecord.items[k].status !== 'pending').length,
        totalItems: INSPECTION_ITEM_KEYS.length,
        skippedItems: skippedKeys,
        failedItems: failedKeys,
        status: 'completed',
        lastUpdateTime: now,
        recordId: newRecord.id,
        isRelief: isRelief,
        tempZone: state.currentTask.tempZone,
        currentTemp: newRecord.currentTemp,
        waybillNo: state.currentTask.waybillNo,
        goodsName: newRecord.goodsName,
        targetTemp: newRecord.targetTemp,
        reviewStatus: autoReviewStatus,
        contactLog: []
      });
      storage.setCurrentTask(null);
      return {
        ...state,
        currentRecord: newRecord
      };
    }
    case 'LOAD_RECORD': {
      return {
        ...state,
        currentRecord: action.payload,
        currentTemp: action.payload.currentTemp
      };
    }
    case 'RESET': {
      storage.setCurrentTask(null);
      return initialState;
    }
    default:
      return state;
  }
};

interface InspectionContextType {
  state: InspectionState;
  dispatch: React.Dispatch<InspectionAction>;
  startInspection: (task: Task) => void;
  updateItem: (key: InspectionItemKey, status: CheckStatus, photo?: string, remark?: string) => void;
  setTemperature: (temp: number) => void;
  setInspector: (name: string | null) => void;
  setReliefMode: (enabled: boolean) => void;
  setMatchingData: (data: { temp: number; waybillNo: string; tempZone: TempZoneType; verified: boolean; goodsName?: string; targetTemp?: string }) => void;
  completeInspection: () => void;
  resetInspection: () => void;
  canSubmit: () => boolean;
  isTempBlocked: () => boolean;
  getProgress: () => number;
  loadRecord: (record: InspectionRecord) => void;
}

const InspectionContext = createContext<InspectionContextType | undefined>(undefined);

export const InspectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(inspectionReducer, initialState);

  const startInspection = (task: Task) => {
    dispatch({ type: 'SET_TASK', payload: task });
    console.log('[InspectionContext] Start inspection for task:', task.id);
  };

  const updateItem = (key: InspectionItemKey, status: CheckStatus, photo?: string, remark?: string) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { key, status, photo, remark } });
    console.log('[InspectionContext] Update item:', key, status);
  };

  const setTemperature = (temp: number) => {
    dispatch({ type: 'SET_TEMP', payload: temp });
    console.log('[InspectionContext] Set temperature:', temp);
  };

  const setInspector = (name: string | null) => {
    dispatch({ type: 'SET_INSPECTOR', payload: name });
    console.log('[InspectionContext] Set inspector:', name);
  };

  const setReliefMode = (enabled: boolean) => {
    dispatch({ type: 'SET_RELIEF_MODE', payload: enabled });
    console.log('[InspectionContext] Set relief mode:', enabled);
  };

  const setMatchingData = (data: { temp: number; waybillNo: string; tempZone: TempZoneType; verified: boolean; goodsName?: string; targetTemp?: string }) => {
    dispatch({ type: 'SET_MATCHING_DATA', payload: data });
    console.log('[InspectionContext] Set matching data:', data);
  };

  const completeInspection = () => {
    dispatch({ type: 'COMPLETE_INSPECTION' });
    console.log('[InspectionContext] Inspection completed');
  };

  const resetInspection = () => {
    dispatch({ type: 'RESET' });
    console.log('[InspectionContext] Inspection reset');
  };

  const canSubmit = (): boolean => {
    if (!state.currentRecord) return false;
    const allChecked = INSPECTION_ITEM_KEYS.every(
      key => state.currentRecord!.items[key].status !== 'pending'
    );
    return allChecked;
  };

  const isTempBlocked = (): boolean => {
    if (!state.currentTask) return false;
    if (state.matchingVerified) return false;
    if (state.currentTemp === 0) return false;
    const isMatch = checkTempMatch(state.currentTemp, state.currentTask.tempZone);
    return !isMatch;
  };

  const getProgress = (): number => {
    if (!state.currentRecord) return 0;
    const checkedCount = INSPECTION_ITEM_KEYS.filter(
      key => state.currentRecord!.items[key].status !== 'pending'
    ).length;
    return (checkedCount / INSPECTION_ITEM_KEYS.length) * 100;
  };

  const loadRecord = (record: InspectionRecord) => {
    dispatch({ type: 'LOAD_RECORD', payload: record });
    console.log('[InspectionContext] Record loaded:', record.id);
  };

  return (
    <InspectionContext.Provider
      value={{
        state,
        dispatch,
        startInspection,
        updateItem,
        setTemperature,
        setInspector,
        setReliefMode,
        setMatchingData,
        completeInspection,
        resetInspection,
        canSubmit,
        isTempBlocked,
        getProgress,
        loadRecord
      }}
    >
      {children}
    </InspectionContext.Provider>
  );
};

export const useInspection = (): InspectionContextType => {
  const context = useContext(InspectionContext);
  if (!context) {
    throw new Error('useInspection must be used within an InspectionProvider');
  }
  return context;
};
