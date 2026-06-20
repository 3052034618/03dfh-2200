import React, { useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { CheckStatus, InspectionItemKey, DriverInspectionStatus } from '@/types';
import { INSPECTION_ITEMS, INSPECTION_ITEM_KEYS, getTempZoneConfig } from '@/data/inspection';
import { useInspection } from '@/store/inspection.context';
import { storage } from '@/utils/storage';
import TempZoneTag from '@/components/TempZoneTag';

const InspectionResultPage: React.FC = () => {
  const { state, resetInspection } = useInspection();

  const loadReviewStatus = useCallback((): DriverInspectionStatus | null => {
    if (!state.currentRecord?.plateNumber) return null;
    const statuses = storage.getDriverStatuses();
    return statuses.find(s => s.plateNumber === state.currentRecord?.plateNumber) || null;
  }, [state.currentRecord]);

  const reviewStatus = useMemo(() => loadReviewStatus(), [loadReviewStatus, state.currentRecord]);

  useDidShow(() => {
    // 页面显示时刷新复核状态
  });

  const summary = useMemo(() => {
    if (!state.currentRecord) return null;
    
    const items = state.currentRecord.items;
    let passed = 0, skipped = 0, failed = 0;
    
    Object.values(items).forEach(item => {
      if (item.status === 'passed') passed++;
      else if (item.status === 'skipped') skipped++;
      else if (item.status === 'failed') failed++;
    });

    return { passed, skipped, failed, total: passed + skipped + failed };
  }, [state.currentRecord]);

  const hasSkipped = summary && summary.skipped > 0;
  const hasFailed = summary && summary.failed > 0;
  const isRelief = state.isReliefInspection || state.currentRecord?.inspectorName;

  const getItemStatusClass = (status: CheckStatus): string => {
    switch (status) {
      case 'passed': return styles.passedBg;
      case 'skipped': return styles.skippedBg;
      case 'failed': return styles.failedBg;
      default: return '';
    }
  };

  const getStatusTextClass = (status: CheckStatus): string => {
    switch (status) {
      case 'passed': return styles.statusPassed;
      case 'skipped': return styles.statusSkipped;
      case 'failed': return styles.statusFailed;
      default: return '';
    }
  };

  const getStatusText = (status: CheckStatus): string => {
    switch (status) {
      case 'passed': return '通过';
      case 'skipped': return '跳过';
      case 'failed': return '异常';
      default: return '待检';
    }
  };

  const handleBackHome = () => {
    resetInspection();
    Taro.switchTab({ url: '/pages/inspection/index' });
  };

  const handleViewReport = () => {
    Taro.showModal({
      title: '检查报告',
      content: '检查报告已生成，可在历史记录中查看完整信息。',
      showCancel: false
    });
  };

  if (!state.currentRecord || !state.currentTask) {
    return (
      <View className={styles.page}>
        <View className={styles.content}>
          <View className={styles.reportCard}>
            <Text className={styles.cardTitle}>暂无检查记录</Text>
            <Button
              className={classnames(styles.primaryBtn)}
              onClick={handleBackHome}
              style={{ width: '100%', marginTop: '32rpx' }}
            >
              返回首页
            </Button>
          </View>
        </View>
      </View>
    );
  }

  const tempZoneConfig = getTempZoneConfig(state.currentRecord.tempZone);
  const isTempMatch = state.currentRecord.isTempMatch || 
    (state.currentRecord.currentTemp !== 0 && 
     state.currentRecord.items.precooling.status === 'passed') ||
    state.matchingVerified;

  return (
    <View className={styles.page}>
      <View className={styles.successHeader}>
        <Text className={styles.successIcon}>✅</Text>
        <Text className={styles.successTitle}>检查完成</Text>
        <Text className={styles.successSubtitle}>
          检查报告已提交，{hasFailed ? '存在异常项目，请及时处理' : '可以正常发车'}
        </Text>
      </View>

      <View className={styles.content}>
        <View className={styles.reportCard}>
          <Text className={styles.cardTitle}>基本信息</Text>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>车牌号</Text>
            <Text className={styles.infoValue}>{state.currentRecord.plateNumber}</Text>
          </View>
          {isRelief && state.currentRecord.inspectorName && state.currentRecord.originalDriverName ? (
            <>
              <View className={styles.infoRow}>
                <Text className={styles.infoLabel}>司机信息</Text>
                <View className={styles.relDriverDisplay}>
                  <View className={styles.relDriverBox}>
                    <Text className={styles.relDriverLabel}>原司机</Text>
                    <Text className={styles.relDriverName}>{state.currentRecord.originalDriverName}</Text>
                  </View>
                  <Text className={styles.relDriverArrow}>→</Text>
                  <View className={classnames(styles.relDriverBox, styles.relDriverBoxActive)}>
                    <Text className={styles.relDriverLabel}>代检人</Text>
                    <Text className={styles.relDriverName}>{state.currentRecord.inspectorName}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>司机</Text>
              <Text className={styles.infoValue}>
                {state.currentRecord.driverName}
              </Text>
            </View>
          )}
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>发车时间</Text>
            <Text className={styles.infoValue}>{state.currentRecord.departureTime}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>运单号</Text>
            <Text className={styles.infoValue}>{state.currentRecord.waybillNo}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>温区要求</Text>
            <View style={{ flex: 1 }}>
              <TempZoneTag type={state.currentRecord.tempZone} showTemp size="sm" />
            </View>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>当前温度</Text>
            <Text className={styles.infoValue}>{state.currentRecord.currentTemp}℃</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>检查时间</Text>
            <Text className={styles.infoValue}>
              {dayjs(state.currentRecord.completedAt || Date.now()).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </View>

          {state.currentRecord.matchingVerified && (
            <View className={styles.matchingTraceCard}>
              <Text className={styles.matchingTraceTitle}>📦 温区匹配验证追溯</Text>
              <View className={styles.matchingTraceRow}>
                <Text className={styles.matchingTraceLabel}>运单号</Text>
                <Text className={styles.matchingTraceValue}>{state.currentRecord.matchingWaybillNo || state.currentRecord.waybillNo}</Text>
              </View>
              {state.currentRecord.goodsName && (
                <View className={styles.matchingTraceRow}>
                  <Text className={styles.matchingTraceLabel}>货品名称</Text>
                  <Text className={styles.matchingTraceValue}>{state.currentRecord.goodsName}</Text>
                </View>
              )}
              {state.currentRecord.targetTemp && (
                <View className={styles.matchingTraceRow}>
                  <Text className={styles.matchingTraceLabel}>目标温度</Text>
                  <Text className={styles.matchingTraceValue}>{state.currentRecord.targetTemp}</Text>
                </View>
              )}
              {state.currentRecord.matchingTemp !== undefined && (
                <View className={styles.matchingTraceRow}>
                  <Text className={styles.matchingTraceLabel}>验证温度</Text>
                  <Text className={styles.matchingTraceValue}>{state.currentRecord.matchingTemp}℃</Text>
                </View>
              )}
              <View className={styles.matchingTraceRow}>
                <Text className={styles.matchingTraceLabel}>验证结果</Text>
                <Text className={classnames(styles.matchingTraceValue, styles.matchingSuccess)}>✅ 验证通过</Text>
              </View>
            </View>
          )}

          <View className={classnames(styles.tempMatchCard, !isTempMatch && styles.tempMismatchCard)}>
            <Text className={styles.tempMatchText}>
              {isTempMatch 
                ? `✅ 温度匹配：${state.currentRecord.currentTemp}℃ 符合${tempZoneConfig.label}区要求`
                : `⚠️ 温度不匹配：${state.currentRecord.currentTemp}℃ 不符合${tempZoneConfig.label}区要求（${tempZoneConfig.tempRange}）`}
            </Text>
          </View>
        </View>

        {summary && (
          <View className={styles.summaryCard}>
            <Text className={styles.cardTitle}>检查汇总</Text>
            <View className={styles.summaryRow}>
              <Text className={styles.summaryLabel}>通过</Text>
              <Text className={styles.summaryValue} style={{ color: 'var(--color-success, #00C853)' }}>
                {summary.passed} 项
              </Text>
            </View>
            <View className={styles.summaryRow}>
              <Text className={styles.summaryLabel}>跳过</Text>
              <Text className={styles.summaryValue} style={{ color: 'var(--color-warning, #FF6D00)' }}>
                {summary.skipped} 项
              </Text>
            </View>
            <View className={styles.summaryRow}>
              <Text className={styles.summaryLabel}>异常</Text>
              <Text className={styles.summaryValue} style={{ color: 'var(--color-error, #D50000)' }}>
                {summary.failed} 项
              </Text>
            </View>
          </View>
        )}

        <View className={classnames(styles.reportCard, styles.itemsSection)}>
          <Text className={styles.cardTitle}>检查明细</Text>
          {INSPECTION_ITEM_KEYS.map((key: InspectionItemKey, index: number) => {
            const item = INSPECTION_ITEMS.find(i => i.key === key)!;
            const record = state.currentRecord!.items[key];
            return (
              <View key={key} className={styles.itemRow}>
                <View className={classnames(styles.itemIndex, getItemStatusClass(record.status))}>
                  {index + 1}
                </View>
                <View className={styles.itemInfo}>
                  <Text className={styles.itemName}>{item.title}</Text>
                  {record.remark && (
                    <Text className={styles.itemRemark}>备注：{record.remark}</Text>
                  )}
                </View>
                {record.photo && (
                  <View className={styles.photoIndicator} title="已拍照留档">📷</View>
                )}
                <Text className={classnames(styles.statusText, getStatusTextClass(record.status))}>
                  {getStatusText(record.status)}
                </Text>
              </View>
            );
          })}
        </View>

        {isRelief && (
          <View className={styles.reliefCard}>
            <Text className={styles.reliefCardTitle}>🔄 临时替班说明</Text>
            <Text className={styles.reliefCardText}>
              本次检查由 {state.currentRecord.inspectorName} 代
              {state.currentRecord.originalDriverName || state.currentRecord.driverName} 执行，
              所有检查结果已如实记录，班组长将进行重点核查。
            </Text>
          </View>
        )}

        {hasSkipped && (
          <View className={styles.warningCard}>
            <Text className={styles.warningTitle}>⚠️ 注意</Text>
            <Text className={styles.warningText}>
              本次检查中有 {summary!.skipped} 项被跳过，已记录在案。班组长将进行抽查，请确保跳过项已确认无安全隐患。
            </Text>
          </View>
        )}

        {hasFailed && (
          <View className={styles.warningCard} style={{ background: 'rgba(213, 0, 0, 0.08)', borderColor: 'rgba(213, 0, 0, 0.3)' }}>
            <Text className={styles.warningTitle} style={{ color: 'var(--color-error, #D50000)' }}>❌ 异常提醒</Text>
            <Text className={styles.warningText}>
              本次检查中有 {summary!.failed} 项存在异常，请立即联系调度员进行处理，禁止带病出车。
            </Text>
          </View>
        )}

        {(reviewStatus?.reviewNote || reviewStatus?.reviewDecision) && (
          <View className={styles.reviewResultCard}>
            <Text className={styles.reviewResultTitle}>👨‍💼 班组长复核结果</Text>
            
            {reviewStatus.reviewDecision && (
              <View className={classnames(
                styles.reviewDecision,
                reviewStatus.reviewDecision === 'release' ? styles.reviewReleased : styles.reviewBlocked
              )}>
                <Text className={styles.reviewDecisionIcon}>
                  {reviewStatus.reviewDecision === 'release' ? '✅' : '🚫'}
                </Text>
                <Text className={styles.reviewDecisionText}>
                  {reviewStatus.reviewDecision === 'release' ? '已允许发车' : '已拦截，需整改'}
                </Text>
                {reviewStatus.reviewClosedAt && (
                  <Text className={styles.reviewDecisionTime}>
                    {dayjs(reviewStatus.reviewClosedAt).format('HH:mm')}
                  </Text>
                )}
              </View>
            )}

            {reviewStatus.reviewNote && (
              <View className={styles.reviewNoteRow}>
                <Text className={styles.reviewNoteLabel}>处理结论</Text>
                <Text className={styles.reviewNoteContent}>{reviewStatus.reviewNote}</Text>
              </View>
            )}

            {reviewStatus.reviewedAt && (
              <Text className={styles.reviewMeta}>
                由 {reviewStatus.reviewedBy || '班组长'} 于 {dayjs(reviewStatus.reviewedAt).format('HH:mm:ss')} 复核
              </Text>
            )}

            {reviewStatus.contactLog && reviewStatus.contactLog.length > 0 && (
              <View className={styles.contactLogBox}>
                <Text className={styles.contactLogTitle}>联系记录</Text>
                {reviewStatus.contactLog.map((log, idx) => (
                  <View key={idx} className={styles.contactLogItem}>
                    <Text className={styles.contactLogType}>
                      {log.type === 'driver' ? '📞 司机' : '📞 仓库'}
                    </Text>
                    <Text className={styles.contactLogContent}>
                      {log.note || '已联系'} · {dayjs(log.contactedAt).format('HH:mm')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <View className={styles.bottomBar}>
        <Button className={styles.secondaryBtn} onClick={handleViewReport}>
          查看报告
        </Button>
        <Button className={styles.primaryBtn} onClick={handleBackHome}>
          返回首页
        </Button>
      </View>
    </View>
  );
};

export default InspectionResultPage;
