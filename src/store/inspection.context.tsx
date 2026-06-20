import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { InspectionRecord, InspectionItemKey, CheckStatus, Task } from '@/types';
import { INSPECTION_ITEM_KEYS } from '@/data/inspection';
import { storage } from '@/utils/storage';

interface InspectionState {
  currentTask: Task | null;
  currentRecord: InspectionRecord | null;
  currentTemp: number;
}

type InspectionAction =
  | { type: 'SET_TASK'; payload: Task }
  | { type: 'SET_TEMP'; payload: number }
  | { type: 'UPDATE_ITEM'; payload: { key: InspectionItemKey; status: CheckStatus; photo?: string; remark?: string } }
  | { type: 'COMPLETE_INSPECTION' }
  | { type: 'RESET' }
  | { type: 'LOAD_RECORD'; payload: InspectionRecord };

const initialState: InspectionState = {
  currentTask: null,
  currentRecord: null,
  currentTemp: 0
};

const createEmptyRecord = (task: Task): InspectionRecord => {
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
      const record = createEmptyRecord(action.payload);
      storage.setCurrentTask(action.payload.id);
      return {
        ...state,
        currentTask: action.payload,
        currentRecord: record
      };
    }
    case 'SET_TEMP': {
      if (!state.currentRecord) return state;
      const newRecord = {
        ...state.currentRecord,
        currentTemp: action.payload
      };
      storage.saveInspectionRecord(newRecord);
      return {
        ...state,
        currentTemp: action.payload,
        currentRecord: newRecord
      };
    }
    case 'UPDATE_ITEM': {
      if (!state.currentRecord) return state;
      const { key, status, photo, remark } = action.payload;
      const newRecord = {
        ...state.currentRecord,
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
        completedAt: Date.now()
      };
      storage.saveInspectionRecord(newRecord);
      storage.saveDriverStatus({
        driverName: state.currentTask.driverName,
        plateNumber: state.currentTask.plateNumber,
        completedItems: INSPECTION_ITEM_KEYS.filter(k => newRecord.items[k].status !== 'pending').length,
        totalItems: INSPECTION_ITEM_KEYS.length,
        skippedItems: INSPECTION_ITEM_KEYS.filter(k => newRecord.items[k].status === 'skipped'),
        status: 'completed',
        lastUpdateTime: Date.now()
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
  completeInspection: () => void;
  resetInspection: () => void;
  canSubmit: () => boolean;
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
        completeInspection,
        resetInspection,
        canSubmit,
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
