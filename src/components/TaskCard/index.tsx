import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { Task } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import TempZoneTag from '@/components/TempZoneTag';
import { useInspection } from '@/store/inspection.context';

interface TaskCardProps {
  task: Task;
  onStart?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStart }) => {
  const { startInspection } = useInspection();

  const handleStart = () => {
    startInspection(task);
    Taro.navigateTo({ url: '/pages/inspection-detail/index?itemKey=precooling' });
    onStart?.();
  };

  return (
    <View className={styles.card}>
      <View className={styles.header}>
        <View className={styles.plateNumber}>
          <Text className={styles.plateText}>{task.plateNumber}</Text>
        </View>
        <StatusBadge status={task.status} size="sm" />
      </View>

      <View className={styles.body}>
        <View className={styles.infoRow}>
          <Text className={styles.label}>司机</Text>
          <Text className={styles.value}>{task.driverName}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>发车时间</Text>
          <Text className={styles.valueHighlight}>{task.departureTime}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>目的地</Text>
          <Text className={styles.value}>{task.destination}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>运单号</Text>
          <Text className={styles.value}>{task.waybillNo}</Text>
        </View>
      </View>

      <View className={styles.footer}>
        <TempZoneTag type={task.tempZone} showTemp size="sm" />
        <Button
          className={classnames(styles.startBtn, task.status === 'pending' && styles.active)}
          onClick={handleStart}
          disabled={task.status !== 'pending'}
        >
          {task.status === 'pending' ? '开始检查' : task.status === 'inspecting' ? '检查中' : '已完成'}
        </Button>
      </View>
    </View>
  );
};

export default TaskCard;
