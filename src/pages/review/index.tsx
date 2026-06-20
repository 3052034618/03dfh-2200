import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, ScrollView, Image } from '@tarojs/components';
import { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { DriverInspectionStatus, InspectionItemKey, InspectionRecord, CheckStatus } from '@/types';
import { MOCK_DRIVER_STATUSES } from '@/data/mock';
import { INSPECTION_ITEMS, INSPECTION_ITEM_KEYS, getTempZoneConfig } from '@/data/inspection';
import { storage } from '@/utils/storage';
import StatusBadge from '@/components/StatusBadge';
import TempZoneTag from '@/components/TempZoneTag';

type FilterType = 'all' | 'pending' | 'in_progress' | 'has_skipped' | 'has_failed' | 'urgent';

const filterOptions: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'urgent', label: '🚨 临近发车' },
  { key: 'pending', label: '待检查' },
  { key: 'in_progress', label: '检查中' },
  { key: 'has_skipped', label: '有跳过' },
  { key: 'has_failed', label: '有异常' }
];

const ReviewPage: React.FC = () => {
  const [statuses, setStatuses] = useState<DriverInspectionStatus[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const loadData = useCallback(() => {
    console.log('[ReviewPage] Loading driver statuses...');
    setLoading(true);
    setTimeout(() => {
      const savedRecords = storage.getInspectionRecords();
      const savedStatuses = storage.getDriverStatuses();
      
      const combined: DriverInspectionStatus[] = [];
      const processedPlates = new Set<string>();

      savedRecords.filter(r => r.completedAt).forEach(record => {
        processedPlates.add(record.plateNumber);
        const skipped = INSPECTION_ITEM_KEYS.filter(k => record.items[k].status === 'skipped');
        const failed = INSPECTION_ITEM_KEYS.filter(k => record.items[k].status === 'failed');
        
        const mockData = MOCK_DRIVER_STATUSES.find(m => m.plateNumber === record.plateNumber);
        combined.push({
          driverName: record.driverName,
          originalDriverName: record.originalDriverName,
          inspectorName: record.inspectorName,
          plateNumber: record.plateNumber,
          departureTime: record.departureTime,
          departureTimestamp: mockData?.departureTimestamp || Date.now(),
          completedItems: INSPECTION_ITEM_KEYS.filter(k => record.items[k].status !== 'pending').length,
          totalItems: INSPECTION_ITEM_KEYS.length,
          skippedItems: skipped,
          failedItems: failed,
          status: 'completed',
          lastUpdateTime: record.completedAt || Date.now(),
          recordId: record.id,
          isRelief: !!record.inspectorName,
          tempZone: record.tempZone,
          currentTemp: record.currentTemp,
          waybillNo: record.waybillNo
        });
      });

      savedStatuses.forEach(status => {
        if (!processedPlates.has(status.plateNumber)) {
          processedPlates.add(status.plateNumber);
          combined.push(status);
        }
      });

      MOCK_DRIVER_STATUSES.forEach(mock => {
        if (!processedPlates.has(mock.plateNumber)) {
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

  const sortedStatuses = useMemo(() => {
    return [...statuses].sort((a, b) => a.departureTimestamp - b.departureTimestamp);
  }, [statuses]);

  const filteredStatuses = useMemo(() => {
    const now = Date.now();
    return sortedStatuses.filter(s => {
      const isUrgent = s.departureTimestamp - now < 30 * 60 * 1000 && s.status !== 'completed';
      
      switch (filter) {
        case 'pending':
          return s.status === 'pending';
        case 'in_progress':
          return s.status === 'in_progress';
        case 'has_skipped':
          return s.skippedItems.length > 0;
        case 'has_failed':
          return (s.failedItems?.length || 0) > 0;
        case 'urgent':
          return isUrgent || (s.skippedItems.length > 0 && s.status !== 'completed');
        default:
          return true;
      }
    });
  }, [sortedStatuses, filter]);

  const stats = useMemo(() => {
    const now = Date.now();
    const completed = statuses.filter(s => s.status === 'completed').length;
    const inProgress = statuses.filter(s => s.status === 'in_progress').length;
    const pending = statuses.filter(s => s.status === 'pending').length;
    const hasSkipped = statuses.filter(s => s.skippedItems.length > 0).length;
    const hasFailed = statuses.filter(s => (s.failedItems?.length || 0) > 0).length;
    const urgent = statuses.filter(s => {
      const isNearDeparture = s.departureTimestamp - now < 30 * 60 * 1000 && s.status !== 'completed';
      return isNearDeparture || (s.skippedItems.length > 0 && s.status !== 'completed');
    }).length;
    return { completed, inProgress, pending, hasSkipped, hasFailed, urgent, total: statuses.length };
  }, [statuses]);

  const getItemTitle = (key: InspectionItemKey): string => {
    return INSPECTION_ITEMS.find(i => i.key === key)?.title || key;
  };

  const getItemData = (key: InspectionItemKey) => {
    return INSPECTION_ITEMS.find(i => i.key === key);
  };

  const formatTime = (timestamp: number): string => {
    return dayjs(timestamp).format('HH:mm:ss');
  };

  const getCountdownText = (timestamp: number, status: string): string => {
    const now = Date.now();
    const diff = timestamp - now;
    const diffMinutes = Math.floor(diff / 60000);
    
    if (status === 'completed') return '✓ 已完成';
    if (diff < 0) return '已过发车时间';
    if (diffMinutes < 10) return `🚨 ${diffMinutes}分钟后发车`;
    if (diffMinutes < 30) return `⚠️ ${diffMinutes}分钟后发车`;
    return `${Math.floor(diffMinutes / 60)}小时${diffMinutes % 60}分后发车`;
  };

  const isUrgentCard = (status: DriverInspectionStatus): boolean => {
    const now = Date.now();
    const diffMinutes = Math.floor((status.departureTimestamp - now) / 60000);
    const hasProblems = status.skippedItems.length > 0 || (status.failedItems?.length || 0) > 0;
    return (diffMinutes < 30 && status.status !== 'completed') || (hasProblems && status.status !== 'completed');
  };

  const handleCardClick = (plateNumber: string) => {
    setExpandedId(expandedId === plateNumber ? null : plateNumber);
  };

  const getInspectionRecord = (status: DriverInspectionStatus): InspectionRecord | null => {
    if (!status.recordId) return null;
    const records = storage.getInspectionRecords();
    return records.find(r => r.id === status.recordId) || null;
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

  const handleContactWarehouse = () => {
    Taro.makePhoneCall({
      phoneNumber: '400-888-8888',
      fail: (e) => {
        console.error('[ReviewPage] Call warehouse failed:', e);
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

  const handleViewPhoto = (photoUrl: string) => {
    setViewingPhoto(photoUrl);
  };

  const closePhotoViewer = () => {
    setViewingPhoto(null);
  };

  const getStatusBadge = (status: CheckStatus): React.ReactNode => {
    const badgeMap: Record<string, { text: string; className: string }> = {
      passed: { text: '通过', className: styles.badgePassed },
      skipped: { text: '跳过', className: styles.badgeSkipped },
      failed: { text: '异常', className: styles.badgeFailed },
      pending: { text: '待检', className: styles.badgePending }
    };
    const badge = badgeMap[status] || badgeMap.pending;
    return (
      <View className={classnames(styles.itemBadge, badge.className)}>
        <Text className={styles.itemBadgeText}>{badge.text}</Text>
      </View>
    );
  };

  return (
    <View className={styles.page}>
      <View className={styles.statsSection}>
        <Text className={styles.sectionTitle}>🚦 早高峰发车看板</Text>
        <Text className={styles.sectionSubtitle}>
          按发车时间排序 · 临近发车自动高亮
        </Text>
        <View className={styles.statsRow}>
          <View className={classnames(styles.statCard, stats.urgent > 0 && styles.statUrgent)}>
            <Text className={styles.statValue}>{stats.urgent}</Text>
            <Text className={styles.statLabel}>需关注</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.inProgress}</Text>
            <Text className={styles.statLabel}>检查中</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.completed}</Text>
            <Text className={styles.statLabel}>已完成</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.total}</Text>
            <Text className={styles.statLabel}>总车辆</Text>
          </View>
        </View>
      </View>

      <View className={styles.filterSection}>
        <ScrollView scrollX className={styles.filterScroll}>
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
        </ScrollView>
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
          filteredStatuses.map(status => {
            const urgent = isUrgentCard(status);
            const record = getInspectionRecord(status);
            const countdown = getCountdownText(status.departureTimestamp, status.status);
            
            return (
              <View 
                key={status.plateNumber} 
                className={classnames(
                  styles.driverCard,
                  urgent && styles.driverCardUrgent,
                  (status.failedItems?.length || 0) > 0 && styles.driverCardFailed
                )}
              >
                <View
                  className={styles.driverCardHeader}
                  onClick={() => handleCardClick(status.plateNumber)}
                >
                  <View className={styles.plateSection}>
                    <View className={styles.plateNumber}>
                      <Text className={styles.plateText}>{status.plateNumber}</Text>
                    </View>
                    <View className={styles.driverInfo}>
                      <Text className={styles.driverName}>
                        {status.inspectorName || status.driverName}
                        {status.isRelief && <Text className={styles.reliefTag}> 🔄 代检</Text>}
                      </Text>
                      {status.originalDriverName && (
                        <Text className={styles.originalDriver}>原司机：{status.originalDriverName}</Text>
                      )}
                    </View>
                  </View>

                  <View className={styles.rightSection}>
                    <View className={styles.departureInfo}>
                      <Text className={styles.departureTime}>{status.departureTime}</Text>
                      <Text className={classnames(
                        styles.countdownText,
                        urgent && styles.countdownUrgent
                      )}>
                        {countdown}
                      </Text>
                    </View>
                    <StatusBadge status={status.status} size="sm" />
                  </View>
                </View>

                <View className={styles.progressBarSection}>
                  <View className={styles.progressRow}>
                    <Text className={styles.progressLabel}>检查进度</Text>
                    <Text className={styles.progressValue}>
                      {status.completedItems}/{status.totalItems}
                    </Text>
                  </View>
                  <View className={styles.progressBar}>
                    <View
                      className={classnames(
                        styles.progressFill,
                        status.status === 'completed' && styles.progressComplete,
                        (status.skippedItems.length > 0 || (status.failedItems?.length || 0) > 0) && styles.progressWarning
                      )}
                      style={{ width: `${(status.completedItems / status.totalItems) * 100}%` }}
                    />
                  </View>
                  <View className={styles.issueTags}>
                    {status.skippedItems.length > 0 && (
                      <View className={classnames(styles.issueTag, styles.issueSkip)}>
                        <Text className={styles.issueTagText}>⚠️ 跳过{status.skippedItems.length}项</Text>
                      </View>
                    )}
                    {(status.failedItems?.length || 0) > 0 && (
                      <View className={classnames(styles.issueTag, styles.issueFail)}>
                        <Text className={styles.issueTagText}>❌ 异常{status.failedItems.length}项</Text>
                      </View>
                    )}
                    {status.tempZone && (
                      <View style={{ marginLeft: 'auto' }}>
                        <TempZoneTag type={status.tempZone} size="sm" />
                      </View>
                    )}
                  </View>
                </View>

                {expandedId === status.plateNumber && (
                  <View className={styles.driverCardDetail}>
                    <View className={styles.detailHeader}>
                      <Text className={styles.detailTitle}>检查明细</Text>
                      {status.waybillNo && (
                        <Text className={styles.waybillText}>运单：{status.waybillNo}</Text>
                      )}
                    </View>

                    <View className={styles.itemsList}>
                      {INSPECTION_ITEM_KEYS.map((key, idx) => {
                        const item = getItemData(key);
                        const itemStatus = record?.items[key]?.status || (
                          status.completedItems > idx ? 'passed' : 'pending'
                        );
                        const itemPhoto = record?.items[key]?.photo;
                        const itemRemark = record?.items[key]?.remark;

                        return (
                          <View key={key} className={styles.detailItem}>
                            <View className={styles.detailItemIndex}>{idx + 1}</View>
                            <View className={styles.detailItemContent}>
                              <View className={styles.detailItemHeader}>
                                <Text className={styles.detailItemName}>{item?.title}</Text>
                                {getStatusBadge(itemStatus)}
                              </View>
                              {itemRemark && (
                                <Text className={styles.detailItemRemark}>备注：{itemRemark}</Text>
                              )}
                              {itemPhoto ? (
                                <View 
                                  className={styles.detailItemPhoto}
                                  onClick={() => handleViewPhoto(itemPhoto)}
                                >
                                  <Image 
                                    className={styles.photoThumb} 
                                    src={itemPhoto} 
                                    mode="aspectFill"
                                  />
                                  <Text className={styles.photoLabel}>📷 点击查看</Text>
                                </View>
                              ) : (
                                itemStatus !== 'pending' && (
                                  <Text className={styles.noPhotoText}>未拍照留档</Text>
                                )
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {status.tempZone && status.currentTemp !== undefined && (
                      <View className={styles.tempSection}>
                        <Text className={styles.tempSectionTitle}>🌡️ 温度信息</Text>
                        <View className={styles.tempRow}>
                          <Text className={styles.tempLabel}>温区要求</Text>
                          <View style={{ flex: 1 }}>
                            <TempZoneTag type={status.tempZone} showTemp size="sm" />
                          </View>
                        </View>
                        <View className={styles.tempRow}>
                          <Text className={styles.tempLabel}>当前温度</Text>
                          <Text className={styles.tempValue}>{status.currentTemp}℃</Text>
                        </View>
                      </View>
                    )}

                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>最后更新</Text>
                      <Text className={styles.detailValue}>
                        {formatTime(status.lastUpdateTime)}
                      </Text>
                    </View>

                    <View className={styles.actionRow}>
                      <Button
                        className={classnames(styles.actionBtn, styles.secondary)}
                        onClick={handleContactWarehouse}
                      >
                        联系仓库
                      </Button>
                      <Button
                        className={classnames(styles.actionBtn, styles.secondary)}
                        onClick={() => handleCallDriver(status.inspectorName || status.driverName)}
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

                <View 
                  className={classnames(styles.expandIndicator, expandedId === status.plateNumber && styles.expanded)}
                  onClick={() => handleCardClick(status.plateNumber)}
                >
                  <Text className={styles.expandText}>
                    {expandedId === status.plateNumber ? '收起' : '查看明细'}
                  </Text>
                  <Text className={styles.expandArrow}>›</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {viewingPhoto && (
        <View className={styles.photoViewer} onClick={closePhotoViewer}>
          <Image 
            className={styles.viewerImage} 
            src={viewingPhoto} 
            mode="aspectFit"
          />
          <View className={styles.viewerClose} onClick={closePhotoViewer}>
            <Text className={styles.viewerCloseText}>× 关闭</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default ReviewPage;
