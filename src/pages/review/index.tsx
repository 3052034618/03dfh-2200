import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, ScrollView, Image, Textarea } from '@tarojs/components';
import { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { DriverInspectionStatus, InspectionItemKey, InspectionRecord, CheckStatus, TempZoneType } from '@/types';
import { MOCK_DRIVER_STATUSES } from '@/data/mock';
import { INSPECTION_ITEMS, INSPECTION_ITEM_KEYS, getTempZoneConfig } from '@/data/inspection';
import { storage } from '@/utils/storage';
import StatusBadge from '@/components/StatusBadge';
import TempZoneTag from '@/components/TempZoneTag';

type FilterType = 'all' | 'pending' | 'in_progress' | 'has_skipped' | 'has_failed' | 'urgent';
type ViewType = 'board' | 'pending' | 'summary';

const filterOptions: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'urgent', label: '🚨 临近发车' },
  { key: 'pending', label: '待检查' },
  { key: 'in_progress', label: '检查中' },
  { key: 'has_skipped', label: '有跳过' },
  { key: 'has_failed', label: '有异常' }
];

const viewOptions: { key: ViewType; label: string }[] = [
  { key: 'board', label: '📋 发车看板' },
  { key: 'pending', label: '⚡ 待处理' },
  { key: 'summary', label: '📊 今日汇总' }
];

const ReviewPage: React.FC = () => {
  const [statuses, setStatuses] = useState<DriverInspectionStatus[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentView, setCurrentView] = useState<ViewType>('board');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

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
        const savedStatus = savedStatuses.find(s => s.plateNumber === record.plateNumber);
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
          waybillNo: record.waybillNo,
          goodsName: record.goodsName,
          targetTemp: record.targetTemp,
          reviewNote: savedStatus?.reviewNote,
          reviewedAt: savedStatus?.reviewedAt,
          reviewedBy: savedStatus?.reviewedBy
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

  const pendingItems = useMemo(() => {
    const now = Date.now();
    return sortedStatuses.filter(s => {
      const diffMinutes = Math.floor((s.departureTimestamp - now) / 60000);
      const isNearDeparture = diffMinutes < 30 && s.status !== 'completed';
      const hasProblems = s.skippedItems.length > 0 || (s.failedItems?.length || 0) > 0;
      return isNearDeparture || (hasProblems && s.status !== 'completed');
    });
  }, [sortedStatuses]);

  const summaryData = useMemo(() => {
    const groups: Record<TempZoneType, {
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
      failed: number;
      skipped: number;
      items: DriverInspectionStatus[];
    }> = {
      frozen: { total: 0, completed: 0, inProgress: 0, pending: 0, failed: 0, skipped: 0, items: [] },
      refrigerated: { total: 0, completed: 0, inProgress: 0, pending: 0, failed: 0, skipped: 0, items: [] },
      constant: { total: 0, completed: 0, inProgress: 0, pending: 0, failed: 0, skipped: 0, items: [] }
    };

    sortedStatuses.forEach(s => {
      if (!s.tempZone) return;
      const g = groups[s.tempZone];
      g.total++;
      g.items.push(s);
      if (s.status === 'completed') g.completed++;
      else if (s.status === 'in_progress') g.inProgress++;
      else g.pending++;
      if ((s.failedItems?.length || 0) > 0) g.failed++;
      if (s.skippedItems.length > 0) g.skipped++;
    });

    return groups;
  }, [sortedStatuses]);

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

  const handleSaveNote = (status: DriverInspectionStatus) => {
    const note = reviewNote[status.plateNumber]?.trim();
    if (!note) {
      Taro.showToast({ title: '请输入处理结论', icon: 'none' });
      return;
    }

    setSavingNote(status.plateNumber);
    setTimeout(() => {
      const allStatuses = storage.getDriverStatuses();
      const existingIndex = allStatuses.findIndex(s => s.plateNumber === status.plateNumber);
      const updatedStatus: DriverInspectionStatus = {
        ...(existingIndex >= 0 ? allStatuses[existingIndex] : status),
        reviewNote: note,
        reviewedAt: Date.now(),
        reviewedBy: '班组长'
      };

      if (existingIndex >= 0) {
        allStatuses[existingIndex] = updatedStatus;
      } else {
        allStatuses.push(updatedStatus);
      }
      storage.saveDriverStatus(updatedStatus);

      setStatuses(prev => prev.map(s => 
        s.plateNumber === status.plateNumber 
          ? { ...s, reviewNote: note, reviewedAt: Date.now(), reviewedBy: '班组长' }
          : s
      ));

      setSavingNote(null);
      Taro.showToast({ title: '已保存处理结论', icon: 'success' });
      console.log('[ReviewPage] Review note saved:', status.plateNumber, note);
    }, 500);
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

  const getCompletionRateClass = (completed: number, total: number) => {
    if (total === 0) return styles.rateGood;
    const rate = completed / total;
    if (rate >= 0.9) return styles.rateGood;
    if (rate >= 0.7) return styles.rateWarning;
    return styles.rateBad;
  };

  const renderPendingItem = (status: DriverInspectionStatus) => {
    const now = Date.now();
    const diffMinutes = Math.floor((status.departureTimestamp - now) / 60000);
    const isUrgent = diffMinutes < 15 && status.status !== 'completed';
    const countdown = getCountdownText(status.departureTimestamp, status.status);

    return (
      <View 
        key={status.plateNumber}
        className={classnames(styles.pendingItem, isUrgent && styles.pendingItemUrgent)}
      >
        <View className={styles.pendingItemHeader}>
          <Text className={styles.pendingItemPlate}>{status.plateNumber}</Text>
          <Text className={styles.pendingItemCountdown}>{countdown}</Text>
        </View>

        <View className={styles.pendingItemInfo}>
          {diffMinutes < 30 && status.status !== 'completed' && (
            <View className={classnames(styles.pendingItemTag, styles.tagUrgent)}>
              <Text>临近发车</Text>
            </View>
          )}
          {status.skippedItems.length > 0 && (
            <View className={classnames(styles.pendingItemTag, styles.tagSkipped)}>
              <Text>跳过{status.skippedItems.length}项</Text>
            </View>
          )}
          {(status.failedItems?.length || 0) > 0 && (
            <View className={classnames(styles.pendingItemTag, styles.tagFailed)}>
              <Text>异常{status.failedItems.length}项</Text>
            </View>
          )}
        </View>

        <View className={styles.pendingItemDriver}>
          {status.isRelief && status.inspectorName && status.originalDriverName
            ? `🔄 ${status.inspectorName} 代 ${status.originalDriverName}`
            : `👤 ${status.driverName}`
          }
          {status.tempZone && (
            <TempZoneTag type={status.tempZone} size="sm" />
          )}
        </View>

        <View className={styles.pendingItemActions}>
          <Button
            className={classnames(styles.pendingActionBtn, styles.pendingActionSecondary)}
            onClick={handleContactWarehouse}
          >
            联系仓库
          </Button>
          <Button
            className={classnames(styles.pendingActionBtn, styles.pendingActionPrimary)}
            onClick={() => handleCallDriver(status.inspectorName || status.driverName)}
          >
            联系司机
          </Button>
          <Button
            className={classnames(styles.pendingActionBtn, styles.pendingActionDanger)}
            onClick={() => handleCardClick(status.plateNumber)}
          >
            查看详情
          </Button>
        </View>

        {expandedId === status.plateNumber && (
          <View className={styles.reviewNoteSection}>
            <Text className={styles.reviewNoteLabel}>处理结论</Text>
            {status.reviewNote ? (
              <View>
                <View className={styles.reviewNoteSaved}>
                  <Text>✓ {status.reviewNote}</Text>
                </View>
                {status.reviewedAt && (
                  <Text className={styles.reviewNoteMeta}>
                    由 {status.reviewedBy || '班组长'} 于 {formatTime(status.reviewedAt)} 记录
                  </Text>
                )}
              </View>
            ) : (
              <View>
                <Textarea
                  className={styles.reviewNoteInput}
                  placeholder="请输入现场处理结论..."
                  value={reviewNote[status.plateNumber] || ''}
                  onInput={(e) => setReviewNote(prev => ({
                    ...prev,
                    [status.plateNumber]: e.detail.value
                  }))}
                  maxlength={200}
                />
                <Button
                  className={classnames(styles.pendingActionBtn, styles.pendingActionPrimary)}
                  onClick={() => handleSaveNote(status)}
                  disabled={savingNote === status.plateNumber}
                  style={{ width: '100%' }}
                >
                  {savingNote === status.plateNumber ? '保存中...' : '保存处理结论'}
                </Button>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderSummaryGroup = (type: TempZoneType) => {
    const config = getTempZoneConfig(type);
    const data = summaryData[type];
    if (data.total === 0) return null;

    const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    const pendingItems = data.items.filter(s => s.status !== 'completed');

    return (
      <View key={type} className={styles.summaryGroup}>
        <View className={styles.summaryGroupHeader}>
          <View className={styles.summaryGroupTitle}>
            <TempZoneTag type={type} showTemp size="sm" />
            <Text>{config.label}车</Text>
          </View>
          <Text className={classnames(styles.summaryGroupRate, getCompletionRateClass(data.completed, data.total))}>
            完成率 {rate}%
          </Text>
        </View>

        <View className={styles.summaryStats}>
          <View className={styles.summaryStatBox}>
            <Text className={styles.summaryStatValue}>{data.total}</Text>
            <Text className={styles.summaryStatLabel}>总车辆</Text>
          </View>
          <View className={styles.summaryStatBox}>
            <Text className={styles.summaryStatValue} style={{ color: 'var(--color-success, #00C853)' }}>{data.completed}</Text>
            <Text className={styles.summaryStatLabel}>已完成</Text>
          </View>
          <View className={styles.summaryStatBox}>
            <Text className={styles.summaryStatValue} style={{ color: 'var(--color-error, #D50000)' }}>{data.failed}</Text>
            <Text className={styles.summaryStatLabel}>异常</Text>
          </View>
          <View className={styles.summaryStatBox}>
            <Text className={styles.summaryStatValue} style={{ color: 'var(--color-warning, #FF6D00)' }}>{data.skipped}</Text>
            <Text className={styles.summaryStatLabel}>有跳过</Text>
          </View>
        </View>

        <View className={styles.summaryProgressBar}>
          <View
            className={classnames(styles.summaryProgressFill, styles.summaryProgressCompleted)}
            style={{ width: `${rate}%` }}
          />
          {rate < 100 && (
            <View
              className={classnames(styles.summaryProgressFill, styles.summaryProgressPending)}
              style={{ width: `${100 - rate}%` }}
            />
          )}
        </View>

        {pendingItems.length > 0 && (
          <>
            <Text className={styles.summaryListTitle}>未完成车辆 ({pendingItems.length})</Text>
            <View className={styles.summaryList}>
              {pendingItems.map(s => (
                <View key={s.plateNumber} className={styles.summaryListItem}>
                  <View>
                    <Text className={styles.summaryListPlate}>{s.plateNumber}</Text>
                    <Text className={styles.summaryListDriver}>
                      {s.inspectorName || s.driverName} · {s.departureTime}
                    </Text>
                  </View>
                  <View className={classnames(
                    styles.summaryListStatus,
                    s.status === 'in_progress' ? styles.statusInProgress :
                    (s.failedItems?.length || 0) > 0 ? styles.statusFailed : styles.statusPending
                  )}>
                    <Text>
                      {s.status === 'in_progress' ? '检查中' :
                       (s.failedItems?.length || 0) > 0 ? '有异常' : '待检查'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
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

        <View className={styles.viewTabs}>
          {viewOptions.map(option => (
            <Button
              key={option.key}
              className={classnames(styles.viewTabBtn, currentView === option.key && styles.active)}
              onClick={() => setCurrentView(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </View>

        {currentView === 'board' && (
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
        )}
      </View>

      {currentView === 'pending' && (
        <View className={styles.pendingSection}>
          <View className={styles.pendingSectionTitle}>
            <Text>⚡ 待处理列表</Text>
            <Text className={styles.pendingCount}>{pendingItems.length}</Text>
          </View>
          <ScrollView
            className={styles.pendingList}
            scrollY
            style={{ height: 'calc(100vh - 380rpx)' }}
          >
            {pendingItems.length === 0 ? (
              <View className={styles.emptyState}>
                <Text className={styles.emptyIcon}>✅</Text>
                <Text className={styles.emptyText}>暂无待处理项，所有车辆状态正常</Text>
              </View>
            ) : (
              pendingItems.map(s => renderPendingItem(s))
            )}
          </ScrollView>
        </View>
      )}

      {currentView === 'summary' && (
        <ScrollView
          className={styles.summarySection}
          scrollY
          style={{ height: 'calc(100vh - 320rpx)' }}
          refresherEnabled
          refresherTriggered={loading}
          onRefresh={loadData}
        >
          {renderSummaryGroup('frozen')}
          {renderSummaryGroup('refrigerated')}
          {renderSummaryGroup('constant')}
        </ScrollView>
      )}

      {currentView === 'board' && (
        <>
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
                          {status.isRelief && status.inspectorName && status.originalDriverName ? (
                            <>
                              <View className={styles.reliefLine}>
                                <Text className={styles.reliefFrom}>{status.originalDriverName}</Text>
                                <Text className={styles.reliefArrow}>→</Text>
                                <View className={styles.reliefToTag}>
                                  <Text className={styles.reliefToText}>🔄 {status.inspectorName} 代检</Text>
                                </View>
                              </View>
                              <Text className={styles.driverHint}>代班执行检查</Text>
                            </>
                          ) : (
                            <>
                              <Text className={styles.driverName}>{status.driverName}</Text>
                              <Text className={styles.driverHint}>本班司机</Text>
                            </>
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

                        {status.isRelief && status.inspectorName && status.originalDriverName && (
                          <View className={styles.reliefDetailCard}>
                            <Text className={styles.reliefDetailTitle}>🔄 代检关系确认</Text>
                            <View className={styles.reliefDetailRow}>
                              <View className={styles.reliefDetailBox}>
                                <Text className={styles.reliefDetailLabel}>原司机</Text>
                                <Text className={styles.reliefDetailName}>{status.originalDriverName}</Text>
                              </View>
                              <Text className={styles.reliefDetailArrow}>→</Text>
                              <View className={classnames(styles.reliefDetailBox, styles.reliefDetailBoxActive)}>
                                <Text className={styles.reliefDetailLabel}>代检人</Text>
                                <Text className={styles.reliefDetailName}>{status.inspectorName}</Text>
                              </View>
                            </View>
                          </View>
                        )}

                        {record?.matchingVerified && (
                          <View className={styles.reliefDetailCard} style={{ background: 'rgba(0, 200, 83, 0.08)', borderColor: 'rgba(0, 200, 83, 0.3)' }}>
                            <Text className={styles.reliefDetailTitle} style={{ color: '#00C853' }}>✅ 温区匹配验证信息</Text>
                            <View style={{ marginTop: 8, fontSize: 24, color: '#666' }}>
                              {record.goodsName && <Text>货品：{record.goodsName}{'\n'}</Text>}
                              {record.targetTemp && <Text>目标温度：{record.targetTemp}{'\n'}</Text>}
                              {record.matchingTemp !== undefined && <Text>验证温度：{record.matchingTemp}℃{'\n'}</Text>}
                              <Text>运单：{record.matchingWaybillNo || record.waybillNo}</Text>
                            </View>
                          </View>
                        )}

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

                        {status.reviewNote && (
                          <View className={styles.reviewNoteSection} style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
                            <Text className={styles.reviewNoteLabel}>处理结论</Text>
                            <View className={styles.reviewNoteSaved}>
                              <Text>✓ {status.reviewNote}</Text>
                            </View>
                            {status.reviewedAt && (
                              <Text className={styles.reviewNoteMeta}>
                                由 {status.reviewedBy || '班组长'} 于 {formatTime(status.reviewedAt)} 记录
                              </Text>
                            )}
                          </View>
                        )}

                        {!status.reviewNote && (
                          <View className={styles.reviewNoteSection}>
                            <Text className={styles.reviewNoteLabel}>处理结论</Text>
                            <Textarea
                              className={styles.reviewNoteInput}
                              placeholder="请输入现场处理结论..."
                              value={reviewNote[status.plateNumber] || ''}
                              onInput={(e) => setReviewNote(prev => ({
                                ...prev,
                                [status.plateNumber]: e.detail.value
                              }))}
                              maxlength={200}
                            />
                            <Button
                              className={classnames(styles.actionBtn, styles.primary)}
                              onClick={() => handleSaveNote(status)}
                              disabled={savingNote === status.plateNumber}
                              style={{ width: '100%' }}
                            >
                              {savingNote === status.plateNumber ? '保存中...' : '保存处理结论'}
                            </Button>
                          </View>
                        )}

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
        </>
      )}

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
