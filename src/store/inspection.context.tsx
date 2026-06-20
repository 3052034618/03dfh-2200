import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { InspectionRecord, InspectionItemKey, CheckStatus, Task, TempZoneType } from '@/types';
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
}

type InspectionAction =
  | { type: 'SET_TASK'; payload: Task }
  | { type: 'SET_TEMP'; payload: number }
  | { type: 'SET_INSPECTOR'; payload: string | null }
  | { type: 'SET_RELIEF_MODE'; payload: boolean }
  | { type: 'SET_FROM_MATCHING'; payload: boolean }
  | { type: 'SET_MATCHING_DATA'; payload: { temp: number; waybillNo: string; tempZone: TempZoneType; verified: boolean } }
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
  matchingVerified: false
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
  return {
    id: `REC_${now}`,
    taskId: task.id,
    plateNumber: task.plateNumber,
    driverName: task.driverName,
    originalDriverName: isRelief ? task.driverName : undefined,
    inspectorName: inspectorName || undefined,
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
        currentTemp: action.payload.temp
      };
    }
    case 'UPDATE_ITEM': {
      if (!state.currentRecord) return state;
      const { key, status, photo, remark } = action.payload;
      const newRecord = {
        ...state.currentRecord,
        inspectorName: state.inspectorName || state.currentRecord.inspectorName,
        originalDriverName: state.isReliefInspection ? (state.currentTask?.driverName || state.currentRecord.originalDriverName) : state.currentRecord.originalDriverName,
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
      const newRecord = {
        ...state.currentRecord,
        completedAt: Date.now(),
        inspectorName: state.inspectorName || state.currentRecord.inspectorName,
        originalDriverName: state.isReliefInspection ? state.currentTask.driverName : state.currentRecord.originalDriverName
      };
      storage.saveInspectionRecord(newRecord);
      
      const skippedKeys = INSPECTION_ITEM_KEYS.filter(k => newRecord.items[k].status === 'skipped');
      const failedKeys = INSPECTION_ITEM_KEYS.filter(k => newRecord.items[k].status === 'failed');
      
      storage.saveDriverStatus({
        driverName: state.currentTask.driverName,
        originalDriverName: state.isReliefInspection ? state.currentTask.driverName : undefined,
        inspectorName: state.inspectorName || undefined,
        plateNumber: state.currentTask.plateNumber,
        departureTime: state.currentTask.departureTime,
        departureTimestamp: state.currentTask.departureTimestamp,
        completedItems: INSPECTION_ITEM_KEYS.filter(k => newRecord.items[k].status !== 'pending').length,
        totalItems: INSPECTION_ITEM_KEYS.length,
        skippedItems: skippedKeys,
        failedItems: failedKeys,
        status: 'completed',
        lastUpdateTime: Date.now(),
        recordId: newRecord.id,
        isRelief: state.isReliefInspection,
        tempZone: state.currentTask.tempZone,
        currentTemp: newRecord.currentTemp,
        waybillNo: state.currentTask.waybillNo
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
  setMatchingData: (data: { temp: number; waybillNo: string; tempZone: TempZoneType; verified: boolean }) => void;
  completeInspection: () => void;
  resetInspection: () => void;
  canSubmit: () => boolean;
  isTempBlocked: () => boolean;
  getProgress: () => number;
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

  const setMatchingData = (data: { temp: number; waybillNo: string; tempZone: TempZoneType; verified: boolean }) => {
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
        getProgress
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
