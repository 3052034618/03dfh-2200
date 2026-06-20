import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Input, Button } from '@tarojs/components';
import { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import classnames from 'classnames';
import styles from './index.module.scss';
import { Task } from '@/types';
import { MOCK_TASKS } from '@/data/mock';
import { MOCK_WAYBILLS } from '@/data/mock';
import TaskCard from '@/components/TaskCard';
import { storage } from '@/utils/storage';
import { useInspection } from '@/store/inspection.context';

const InspectionPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showReliefModal, setShowReliefModal] = useState(false);
  const [reliefName, setReliefName] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { startInspection, setInspector, setReliefMode, resetInspection } = useInspection();

  const loadTasks = useCallback(() => {
    console.log('[InspectionPage] Loading tasks...');
    setLoading(true);
    setTimeout(() => {
      const savedRecords = storage.getInspectionRecords();
      const completedTaskIds = new Set(savedRecords.filter(r => r.completedAt).map(r => r.taskId));
      
      const updatedTasks = MOCK_TASKS.map(task => {
        if (completedTaskIds.has(task.id)) {
          return { ...task, status: 'completed' as const };
        }
        return task;
      }).sort((a, b) => a.departureTimestamp - b.departureTimestamp);
      
      setTasks(updatedTasks);
      setLoading(false);
      Taro.stopPullDownRefresh();
      console.log('[InspectionPage] Tasks loaded:', updatedTasks.length);
    }, 500);
  }, []);

  useDidShow(() => {
    loadTasks();
  });

  usePullDownRefresh(() => {
    loadTasks();
  });

  const filteredTasks = useMemo(() => {
    if (!searchText.trim()) return tasks;
    const keyword = searchText.trim().toLowerCase();
    return tasks.filter(t => 
      t.plateNumber.toLowerCase().includes(keyword) ||
      t.driverName.toLowerCase().includes(keyword)
    );
  }, [tasks, searchText]);

  const today = dayjs();
  const dateStr = today.format('YYYY年M月D日 dddd');
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'inspecting').length;

  const handleStart = () => {
    loadTasks();
  };

  const handleReliefClick = (task: Task) => {
    if (task.status === 'completed') {
      Taro.showToast({ title: '该车辆已完成检查', icon: 'none' });
      return;
    }
    setSelectedTask(task);
    setShowReliefModal(true);
  };

  const handleReliefConfirm = () => {
    if (!reliefName.trim()) {
      Taro.showToast({ title: '请输入代检人姓名', icon: 'none' });
      return;
    }
    if (!selectedTask) return;

    resetInspection();
    setInspector(reliefName.trim());
    setReliefMode(true);
    
    const reliefTask: Task = {
      ...selectedTask,
      originalDriverName: selectedTask.driverName,
      driverName: selectedTask.driverName,
      inspectorName: reliefName.trim(),
      isRelief: true
    };
    
    startInspection(reliefTask);
    setShowReliefModal(false);
    setReliefName('');
    setSelectedTask(null);
    
    Taro.navigateTo({ url: '/pages/inspection-detail/index?itemKey=precooling' });
  };

  const handleReliefCancel = () => {
    setShowReliefModal(false);
    setReliefName('');
    setSelectedTask(null);
  };

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.dateText}>{dateStr}</Text>
        <Text className={styles.title}>出车前温控检查</Text>
        <View className={styles.statsRow}>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{pendingCount}</Text>
            <Text className={styles.statLabel}>待检查</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{inProgressCount}</Text>
            <Text className={styles.statLabel}>检查中</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{tasks.length - pendingCount - inProgressCount}</Text>
            <Text className={styles.statLabel}>已完成</Text>
          </View>
        </View>
      </View>

      <View className={styles.searchSection}>
        <View className={styles.searchBox}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Input
            className={styles.searchInput}
            placeholder="输入车牌号或司机名快速查找"
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
          />
          {searchText && (
            <Button className={styles.clearBtn} onClick={() => setSearchText('')}>
              ×
            </Button>
          )}
        </View>
        <Button className={styles.reliefEntryBtn} onClick={() => {
          if (filteredTasks.length === 0) {
            Taro.showToast({ title: '暂无可用车辆', icon: 'none' });
            return;
          }
          setShowReliefModal(true);
          setSelectedTask(filteredTasks.find(t => t.status !== 'completed') || filteredTasks[0]);
        }}>
          🔄 替班
        </Button>
      </View>

      <ScrollView
        className={styles.content}
        scrollY
        refresherEnabled
        refresherTriggered={loading}
        onRefresh={loadTasks}
      >
        <View className={styles.tipsCard}>
          <Text className={styles.tipsTitle}>📋 检查须知</Text>
          <Text className={styles.tipsText}>
            出车前请按顺序完成4项检查：车厢预冷温度、温度探头在线、门帘密封条、制冷机油量/电量。每项需拍照留档，温区不匹配将阻止发车。
          </Text>
        </View>

        {showReliefModal && selectedTask && (
          <View className={styles.modalOverlay} onClick={handleReliefCancel}>
            <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <Text className={styles.modalTitle}>🔄 临时替班代检</Text>
              
              <View className={styles.selectedTaskInfo}>
                <View className={styles.selectedTaskPlate}>
                  <Text className={styles.selectedTaskPlateText}>{selectedTask.plateNumber}</Text>
                </View>
                <View className={styles.selectedTaskDetails}>
                  <Text className={styles.selectedTaskDriver}>
                    原司机：{selectedTask.driverName}
                  </Text>
                  <Text className={styles.selectedTaskTime}>
                    发车时间：{selectedTask.departureTime}
                  </Text>
                  <Text className={styles.selectedTaskWaybill}>
                    装车单：{selectedTask.waybillNo}
                  </Text>
                </View>
              </View>

              {MOCK_WAYBILLS[selectedTask.waybillNo] && (
                <View className={styles.waybillPreviewCard}>
                  <View className={styles.waybillPreviewRow}>
                    <Text className={styles.waybillPreviewLabel}>货品名称</Text>
                    <Text className={styles.waybillPreviewValue}>
                      {MOCK_WAYBILLS[selectedTask.waybillNo].goodsName}
                    </Text>
                  </View>
                  <View className={styles.waybillPreviewRow}>
                    <Text className={styles.waybillPreviewLabel}>温区要求</Text>
                    <Text className={styles.waybillPreviewValue}>
                      {MOCK_WAYBILLS[selectedTask.waybillNo].targetTemp}
                    </Text>
                  </View>
                </View>
              )}

              <View className={styles.inputSection}>
                <Text className={styles.inputLabel}>请输入代检人姓名</Text>
                <Input
                  className={styles.nameInput}
                  placeholder="请输入您的姓名"
                  value={reliefName}
                  onInput={(e) => setReliefName(e.detail.value)}
                  maxlength={20}
                />
              </View>

              <View className={styles.modalBtns}>
                <Button className={classnames(styles.modalBtn, styles.modalCancel)} onClick={handleReliefCancel}>
                  取消
                </Button>
                <Button className={classnames(styles.modalBtn, styles.modalConfirm)} onClick={handleReliefConfirm}>
                  确认代检
                </Button>
              </View>
            </View>
          </View>
        )}

        <View className={styles.list}>
          {filteredTasks.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>🚛</Text>
              <Text className={styles.emptyText}>
                {searchText ? '未找到匹配的车辆或司机' : '暂无待出车任务'}
              </Text>
            </View>
          ) : (
            filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onStart={handleStart}
                onRelief={() => handleReliefClick(task)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default InspectionPage;
