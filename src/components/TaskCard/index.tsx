import React, { useMemo } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { Task } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import TempZoneTag from '@/components/TempZoneTag';
import { useInspection } from '@/store/inspection.context';

interface TaskCardProps {
  task: Task;
  onStart?: () => void;
  onRelief?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStart, onRelief }) => {
  const { startInspection } = useInspection();

  const countdownText = useMemo(() => {
    const now = dayjs();
    const departure = dayjs(task.departureTimestamp);
    const diffMinutes = departure.diff(now, 'minute');
    
    if (diffMinutes < 0) return '已过发车时间';
    if (diffMinutes < 10) return `${diffMinutes}分钟后发车 ⚠️`;
    if (diffMinutes < 30) return `${diffMinutes}分钟后发车`;
    return `${Math.floor(diffMinutes / 60)}小时${diffMinutes % 60}分后发车`;
  }, [task.departureTimestamp]);

  const isUrgent = useMemo(() => {
    const now = dayjs();
    const departure = dayjs(task.departureTimestamp);
    const diffMinutes = departure.diff(now, 'minute');
    return diffMinutes < 30 && diffMinutes >= 0;
  }, [task.departureTimestamp]);

  const handleStart = () => {
    startInspection(task);
    Taro.navigateTo({ url: '/pages/inspection-detail/index?itemKey=precooling' });
    onStart?.();
  };

  return (
    <View className={classnames(styles.card, isUrgent && task.status !== 'completed' && styles.urgent)}>
      <View className={styles.header}>
        <View className={styles.plateNumber}>
          <Text className={styles.plateText}>{task.plateNumber}</Text>
        </View>
        <View className={styles.headerRight}>
          {isUrgent && task.status !== 'completed' && (
            <View className={styles.urgentBadge}>
              <Text className={styles.urgentText}>即将发车</Text>
            </View>
          )}
          <StatusBadge status={task.status} size="sm" />
        </View>
      </View>

      {task.originalDriverName && (
        <View className={styles.reliefInfo}>
          <Text className={styles.reliefInfoText}>
            🔄 原司机：{task.originalDriverName}
          </Text>
        </View>
      )}

      <View className={styles.body}>
        <View className={styles.infoRow}>
          <Text className={styles.label}>司机</Text>
          <Text className={styles.value}>{task.driverName}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>发车时间</Text>
          <View className={styles.timeInfo}>
            <Text className={styles.valueHighlight}>{task.departureTime}</Text>
            <Text className={classnames(
              styles.countdown,
              isUrgent && task.status !== 'completed' && styles.countdownUrgent
            )}>
              {countdownText}
            </Text>
          </View>
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
        <View className={styles.btnGroup}>
          {task.status === 'pending' && onRelief && (
            <Button
              className={styles.reliefBtn}
              onClick={onRelief}
            >
              替班
            </Button>
          )}
          <Button
            className={classnames(styles.startBtn, task.status === 'pending' && styles.active)}
            onClick={handleStart}
            disabled={task.status !== 'pending'}
          >
            {task.status === 'pending' ? '开始检查' : task.status === 'inspecting' ? '检查中' : '已完成'}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default TaskCard;
