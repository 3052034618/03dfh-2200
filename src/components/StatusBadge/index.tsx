import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { CheckStatus } from '@/types';

interface StatusBadgeProps {
  status: CheckStatus | 'pending' | 'in_progress' | 'completed';
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: '待检查', className: 'pending' },
  passed: { label: '已通过', className: 'passed' },
  skipped: { label: '已跳过', className: 'skipped' },
  failed: { label: '异常', className: 'failed' },
  in_progress: { label: '检查中', className: 'inProgress' },
  completed: { label: '已完成', className: 'completed' }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <View
      className={classnames(
        styles.badge,
        styles[config.className],
        size === 'sm' && styles.small
      )}
    >
      <Text className={styles.text}>{config.label}</Text>
    </View>
  );
};

export default StatusBadge;
