import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { DriverInspectionStatus, InspectionItemKey } from '@/types';
import { MOCK_DRIVER_STATUSES } from '@/data/mock';
import { INSPECTION_ITEMS } from '@/data/inspection';
import { storage } from '@/utils/storage';
import StatusBadge from '@/components/StatusBadge';

type FilterType = 'all' | 'pending' | 'in_progress' | 'has_skipped';

const filterOptions: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待检查' },
  { key: 'in_progress', label: '检查中' },
  { key: 'has_skipped', label: '有跳过' }
];

const ReviewPage: React.FC = () => {
  const [statuses, setStatuses] = useState<DriverInspectionStatus[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(() => {
    console.log('[ReviewPage] Loading driver statuses...');
    setLoading(true);
    setTimeout(() => {
      const savedStatuses = storage.getDriverStatuses();
      const combined = [...savedStatuses];
      
      MOCK_DRIVER_STATUSES.forEach(mock => {
        const existing = combined.find(s => s.plateNumber === mock.plateNumber);
        if (!existing) {
          combined.push(mock);
        }
      });
      
      setStatuses(combined);
      setLoading(false);
      Taro.stopPullDownRefresh();
      console.log('[ReviewPage] Driver statuses loaded:', combined.length);
    }, 500);
  }, []);

  useDidShow(() => {
    loadData();
  });

  usePullDownRefresh(() => {
    loadData();
  });

  const filteredStatuses = useMemo(() => {
    return statuses.filter(s => {
      switch (filter) {
        case 'pending':
          return s.status === 'pending';
        case 'in_progress':
          return s.status === 'in_progress';
        case 'has_skipped':
          return s.skippedItems.length > 0;
        default:
          return true;
      }
    });
  }, [statuses, filter]);

  const stats = useMemo(() => {
    const completed = statuses.filter(s => s.status === 'completed').length;
    const inProgress = statuses.filter(s => s.status === 'in_progress').length;
    const pending = statuses.filter(s => s.status === 'pending').length;
    const hasSkipped = statuses.filter(s => s.skippedItems.length > 0).length;
    return { completed, inProgress, pending, hasSkipped, total: statuses.length };
  }, [statuses]);

  const getItemTitle = (key: InspectionItemKey): string => {
    return INSPECTION_ITEMS.find(i => i.key === key)?.title || key;
  };

  const formatTime = (timestamp: number): string => {
    return dayjs(timestamp).format('HH:mm:ss');
  };

  const handleCardClick = (plateNumber: string) => {
    setExpandedId(expandedId === plateNumber ? null : plateNumber);
  };

  const handleCallDriver = (driverName: string) => {
    const phoneMap: Record<string, string> = {
      '张师傅': '13800138001',
      '李师傅': '13800138002',
      '王师傅': '13800138003',
      '赵师傅': '13800138004',
      '刘师傅': '13800138005',
      '陈师傅': '13800138006'
    };
    const phone = phoneMap[driverName] || '400-888-8888';
    
    Taro.makePhoneCall({
      phoneNumber: phone,
      fail: (e) => {
        console.error('[ReviewPage] Call failed:', e);
        Taro.showToast({ title: '拨号失败', icon: 'none' });
      }
    });
  };

  const handleVerify = (status: DriverInspectionStatus) => {
    Taro.showModal({
      title: '现场核查确认',
      content: `确认已对 ${status.driverName}(${status.plateNumber}) 进行现场核查？`,
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '已记录核查', icon: 'success' });
          console.log('[ReviewPage] Verified:', status.plateNumber);
        }
      }
    });
  };

  return (
    <View className={styles.page}>
      <View className={styles.statsSection}>
        <Text className={styles.sectionTitle}>今日检查概览</Text>
        <View className={styles.statsRow}>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.completed}</Text>
            <Text className={styles.statLabel}>已完成</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.inProgress}</Text>
            <Text className={styles.statLabel}>检查中</Text>
          </View>
          <View className={classnames(styles.statCard, stats.hasSkipped > 0 && styles.statHighlight)}>
            <Text className={styles.statValue}>{stats.hasSkipped}</Text>
            <Text className={styles.statLabel}>有跳过</Text>
          </View>
        </View>
      </View>

      <View className={styles.filterSection}>
        <View className={styles.filterRow}>
          {filterOptions.map(option => (
            <Button
              key={option.key}
              className={classnames(styles.filterBtn, filter === option.key && styles.active)}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </View>
      </View>

      <ScrollView
        className={styles.listSection}
        scrollY
        refresherEnabled
        refresherTriggered={loading}
        onRefresh={loadData}
      >
        {filteredStatuses.length === 0 ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📋</Text>
            <Text className={styles.emptyText}>暂无符合条件的记录</Text>
          </View>
        ) : (
          filteredStatuses.map(status => (
            <View key={status.plateNumber} className={styles.driverCard}>
              <View
                className={styles.driverCardHeader}
                onClick={() => handleCardClick(status.plateNumber)}
              >
                <View className={styles.plateSection}>
                  <View className={styles.plateNumber}>
                    <Text className={styles.plateText}>{status.plateNumber}</Text>
                  </View>
                  <Text className={styles.driverName}>{status.driverName}</Text>
                </View>

                <View className={styles.progressSection}>
                  <Text className={styles.progressText}>
                    {status.completedItems}/{status.totalItems}
                  </Text>
                  <View className={styles.progressBar}>
                    <View
                      className={styles.progressFill}
                      style={{ width: `${(status.completedItems / status.totalItems) * 100}%` }}
                    />
                  </View>
                </View>

                {status.skippedItems.length > 0 && (
                  <View className={styles.warningBadge}>
                    <Text className={styles.warningText}>
                      ⚠️ {status.skippedItems.length}
                    </Text>
                  </View>
                )}

                <StatusBadge status={status.status} size="sm" />

                <Text
                  className={classnames(
                    styles.arrowIcon,
                    expandedId === status.plateNumber && styles.expanded
                  )}
                >
                  ›
                </Text>
              </View>

              {expandedId === status.plateNumber && (
                <View className={styles.driverCardDetail}>
                  <View className={styles.detailRow}>
                    <Text className={styles.detailLabel}>检查状态</Text>
                    <View className={styles.detailValue}>
                      <StatusBadge status={status.status} />
                    </View>
                  </View>

                  <View className={styles.detailRow}>
                    <Text className={styles.detailLabel}>完成进度</Text>
                    <View className={styles.detailValue}>
                      <Text className={styles.itemTitle}>
                        {status.completedItems} / {status.totalItems} 项
                      </Text>
                    </View>
                  </View>

                  {status.skippedItems.length > 0 && (
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>跳过项目</Text>
                      <View className={styles.detailValue}>
                        <View className={styles.skippedItems}>
                          {status.skippedItems.map(key => (
                            <View key={key} className={styles.skippedTag}>
                              <Text className={styles.skippedTagText}>
                                {getItemTitle(key)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}

                  <View className={styles.detailRow}>
                    <Text className={styles.detailLabel}>更新时间</Text>
                    <View className={styles.detailValue}>
                      <Text className={styles.updateTime}>
                        {formatTime(status.lastUpdateTime)}
                      </Text>
                    </View>
                  </View>

                  <View className={styles.actionRow}>
                    <Button
                      className={classnames(styles.actionBtn, styles.secondary)}
                      onClick={() => handleCallDriver(status.driverName)}
                    >
                      联系司机
                    </Button>
                    <Button
                      className={classnames(styles.actionBtn, styles.primary)}
                      onClick={() => handleVerify(status)}
                    >
                      现场核查
                    </Button>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default ReviewPage;
