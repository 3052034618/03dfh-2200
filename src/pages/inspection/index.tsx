import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { Task } from '@/types';
import { MOCK_TASKS } from '@/data/mock';
import TaskCard from '@/components/TaskCard';
import { storage } from '@/utils/storage';

const InspectionPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

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
      });
      
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

  const today = dayjs();
  const dateStr = today.format('YYYY年M月D日 dddd');
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'inspecting').length;

  const handleStart = () => {
    loadTasks();
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

        <View className={styles.list}>
          {tasks.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>🚛</Text>
              <Text className={styles.emptyText}>暂无待出车任务</Text>
            </View>
          ) : (
            tasks.map(task => (
              <TaskCard key={task.id} task={task} onStart={handleStart} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default InspectionPage;
