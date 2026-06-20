import React, { useState, useEffect } from 'react';
import { View, Text, Image, Input, Button, Textarea } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { InspectionItemKey, CheckStatus } from '@/types';
import { INSPECTION_ITEMS, INSPECTION_ITEM_KEYS, checkTempMatch, getTempZoneConfig } from '@/data/inspection';
import { useInspection } from '@/store/inspection.context';
import TempZoneTag from '@/components/TempZoneTag';

const InspectionDetailPage: React.FC = () => {
  const router = useRouter();
  const { state, updateItem, setTemperature, completeInspection, canSubmit, isTempBlocked, getProgress, resetInspection } = useInspection();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tempInput, setTempInput] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemKey = router.params.itemKey as InspectionItemKey || 'precooling';
  const currentItem = INSPECTION_ITEMS.find(i => i.key === itemKey) || INSPECTION_ITEMS[0];
  const isFirstItem = currentIndex === 0;
  const isLastItem = currentIndex === INSPECTION_ITEM_KEYS.length - 1;
  const progress = getProgress();
  const tempBlocked = isTempBlocked();

  useEffect(() => {
    const index = INSPECTION_ITEM_KEYS.indexOf(itemKey);
    if (index >= 0) {
      setCurrentIndex(index);
    }
    if (state.currentRecord?.items[itemKey]) {
      setPhoto(state.currentRecord.items[itemKey].photo);
      setRemark(state.currentRecord.items[itemKey].remark || '');
    }
    if (itemKey === 'precooling') {
      if (state.matchingVerified && state.matchingWaybillTemp !== 0) {
        setTempInput(state.matchingWaybillTemp.toString());
      } else if (state.currentTemp !== 0) {
        setTempInput(state.currentTemp.toString());
      }
    }
    console.log('[InspectionDetail] Current item:', itemKey, 'Index:', index);
  }, [itemKey, state.currentRecord, state.currentTemp, state.matchingVerified, state.matchingWaybillTemp]);

  useEffect(() => {
    Taro.setNavigationBarTitle({
      title: `检查 ${currentIndex + 1}/${INSPECTION_ITEM_KEYS.length} - ${currentItem.title}`
    });
  }, [currentIndex, currentItem.title]);

  const handleTakePhoto = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sourceType: ['camera', 'album'],
        sizeType: ['compressed']
      });
      const tempFilePath = res.tempFilePaths[0];
      setPhoto(tempFilePath);
      console.log('[InspectionDetail] Photo taken:', tempFilePath);
      Taro.showToast({ title: '拍照成功', icon: 'success' });
    } catch (e) {
      console.error('[InspectionDetail] Take photo failed:', e);
      Taro.showToast({ title: '拍照失败', icon: 'none' });
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(undefined);
  };

  const handleTempChange = (e: any) => {
    const value = e.detail.value;
    setTempInput(value);
    if (value && !isNaN(parseFloat(value))) {
      setTemperature(parseFloat(value));
    }
  };

  const handleContactWarehouse = () => {
    Taro.makePhoneCall({
      phoneNumber: '400-888-8888',
      fail: (e) => {
        console.error('[InspectionDetail] Call failed:', e);
        Taro.showToast({ title: '拨号失败', icon: 'none' });
      }
    });
  };

  const handleStatusSelect = (status: CheckStatus) => {
    if (isSubmitting) return;

    if (itemKey === 'precooling') {
      if (!tempInput || isNaN(parseFloat(tempInput))) {
        Taro.showToast({ title: '请先输入当前温度', icon: 'none' });
        return;
      }
      const temp = parseFloat(tempInput);
      if (status === 'passed' && state.currentTask && !state.matchingVerified) {
        const isMatch = checkTempMatch(temp, state.currentTask.tempZone);
        if (!isMatch) {
          Taro.showModal({
            title: '温度不匹配',
            content: `当前温度 ${temp}℃ 不符合${getTempZoneConfig(state.currentTask.tempZone).label}区要求，不能通过。请联系仓库复核。`,
            confirmText: '联系仓库',
            cancelText: '我知道了',
            success: (res) => {
              if (res.confirm) {
                handleContactWarehouse();
              }
            }
          });
          return;
        }
      }
    }

    if (currentItem.requiresPhoto && !photo && status !== 'skipped') {
      Taro.showToast({ title: '请先拍照留档', icon: 'none' });
      return;
    }

    submitItem(status);
  };

  const submitItem = (status: CheckStatus) => {
    updateItem(itemKey, status, photo, remark);
    
    if (isLastItem) {
      setTimeout(() => {
        showSubmitConfirm();
      }, 300);
    } else {
      navigateToNext();
    }
  };

  const showSubmitConfirm = () => {
    if (!canSubmit()) {
      Taro.showToast({ title: '请完成所有检查项', icon: 'none' });
      return;
    }

    const blocked = isTempBlocked();
    if (blocked && !state.matchingVerified) {
      Taro.showModal({
        title: '温度不匹配，无法提交',
        content: `当前温度 ${state.currentTemp}℃ 不符合温区要求，请联系仓库复核后重新检查。`,
        confirmText: '联系仓库',
        cancelText: '返回修改',
        success: (res) => {
          if (res.confirm) {
            handleContactWarehouse();
          }
        }
      });
      return;
    }

    const hasSkipped = state.currentRecord ? 
      INSPECTION_ITEM_KEYS.some(k => state.currentRecord!.items[k].status === 'skipped') : false;
    const hasFailed = state.currentRecord ?
      INSPECTION_ITEM_KEYS.some(k => state.currentRecord!.items[k].status === 'failed') : false;

    let content = '所有检查项已处理完毕，是否提交检查报告？';
    if (hasSkipped && hasFailed) {
      content = '检查中有跳过和异常项，提交后班组长将进行重点抽查，确认提交？';
    } else if (hasSkipped) {
      content = '检查中有跳过项，提交后班组长将进行抽查，确认提交？';
    } else if (hasFailed) {
      content = '检查中有异常项，提交后需安排处理，确认提交？';
    }

    Taro.showModal({
      title: '提交检查报告',
      content: content,
      confirmText: '确认提交',
      cancelText: '再检查下',
      success: (res) => {
        if (res.confirm) {
          handleSubmit();
        }
      }
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    console.log('[InspectionDetail] Submitting inspection...');
    
    Taro.showLoading({ title: '提交中...', mask: true });

    setTimeout(() => {
      completeInspection();
      Taro.hideLoading();
      Taro.redirectTo({
        url: '/pages/inspection-result/index'
      });
      console.log('[InspectionDetail] Inspection submitted successfully');
    }, 800);
  };

  const navigateToPrev = () => {
    if (isFirstItem) return;
    const prevKey = INSPECTION_ITEM_KEYS[currentIndex - 1];
    Taro.redirectTo({
      url: `/pages/inspection-detail/index?itemKey=${prevKey}`
    });
  };

  const navigateToNext = () => {
    if (isLastItem) return;
    const nextKey = INSPECTION_ITEM_KEYS[currentIndex + 1];
    Taro.redirectTo({
      url: `/pages/inspection-detail/index?itemKey=${nextKey}`
    });
  };

  const handleBack = () => {
    Taro.showModal({
      title: '确认退出',
      content: '退出后当前检查进度将被保存，确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          resetInspection();
          Taro.navigateBack();
        }
      }
    });
  };

  if (!state.currentTask || !state.currentRecord) {
    return (
      <View className={styles.page}>
        <View className={styles.content}>
          <View className={styles.section}>
            <Text className={styles.sectionTitle}>未选择任务</Text>
            <Button
              className={classnames(styles.actionBtn, styles.passBtn)}
              onClick={() => Taro.navigateBack()}
            >
              返回选择任务
            </Button>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View className={styles.progressSection}>
          <View className={styles.progressLabel}>
            <Text className={styles.progressText}>检查进度</Text>
            <Text className={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
          <View className={styles.progressBar}>
            <View className={styles.progressFill} style={{ width: `${progress}%` }} />
          </View>
        </View>

        {state.isReliefInspection && state.inspectorName && (
          <View className={styles.reliefBadge}>
            <Text className={styles.reliefText}>🔄 临时替班 - 代检：{state.inspectorName}</Text>
          </View>
        )}

        <View className={styles.itemHeader}>
          <View className={styles.itemIndex}>
            <Text className={styles.itemIndexText}>{currentIndex + 1}</Text>
          </View>
          <Text className={styles.itemTitle}>{currentItem.title}</Text>
          <TempZoneTag type={state.currentTask.tempZone} size="sm" />
        </View>
      </View>

      <View className={styles.content}>
        {itemKey === 'precooling' && (
          <View className={styles.section}>
            <Text className={styles.sectionTitle}>当前车厢温度</Text>
            <View className={styles.tempInputSection}>
              <View className={styles.tempInputWrapper}>
                <Input
                  className={styles.tempInput}
                  type="digit"
                  placeholder="--"
                  value={tempInput}
                  onInput={handleTempChange}
                />
                <Text className={styles.tempUnit}>℃</Text>
              </View>
              <Text className={styles.tempHint}>
                请输入温控面板显示的实际温度（支持负数）
              </Text>
            </View>
            <View className={styles.standardCard}>
              <Text className={styles.standardText}>
                📋 标准要求：{currentItem.standard}
              </Text>
            </View>
            {state.fromMatching && state.matchingVerified && (
              <View className={styles.matchVerifiedCard}>
                <Text className={styles.matchVerifiedTitle}>✅ 温区已通过匹配验证</Text>
                {state.matchingGoodsName && (
                  <View className={styles.matchInfoRow}>
                    <Text className={styles.matchInfoLabel}>货品</Text>
                    <Text className={styles.matchInfoValue}>{state.matchingGoodsName}</Text>
                  </View>
                )}
                {state.matchingTargetTemp && (
                  <View className={styles.matchInfoRow}>
                    <Text className={styles.matchInfoLabel}>目标温度</Text>
                    <Text className={styles.matchInfoValue}>{state.matchingTargetTemp}</Text>
                  </View>
                )}
                <View className={styles.matchInfoRow}>
                  <Text className={styles.matchInfoLabel}>当前温度</Text>
                  <Text className={styles.matchInfoValue}>{state.matchingWaybillTemp}℃</Text>
                </View>
                <View className={styles.matchInfoRow}>
                  <Text className={styles.matchInfoLabel}>运单号</Text>
                  <Text className={styles.matchInfoValue}>{state.matchingWaybillNo}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {itemKey !== 'precooling' && state.currentTemp !== 0 && (
          <View className={styles.section}>
            <Text className={styles.sectionTitle}>当前车厢温度</Text>
            <View className={styles.tempDisplay}>
              <Text className={styles.tempValue}>{state.currentTemp}</Text>
              <Text className={styles.tempUnitDisplay}>℃</Text>
            </View>
            {tempBlocked && !state.matchingVerified && (
              <View className={styles.tempWarningCard}>
                <Text className={styles.tempWarningText}>
                  ⚠️ 当前温度不符合温区要求，请联系仓库复核
                </Text>
              </View>
            )}
          </View>
        )}

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>检查示例</Text>
          <View className={styles.exampleImageWrapper}>
            <Image
              className={styles.exampleImage}
              src={currentItem.exampleImage}
              mode="aspectFill"
              onError={(e) => console.error('[InspectionDetail] Example image error:', e)}
            />
            <View className={styles.exampleLabel}>
              <Text className={styles.exampleLabelText}>标准示例图</Text>
            </View>
          </View>

          <View className={styles.infoBlock}>
            <Text className={styles.infoLabel}>检查方法</Text>
            <Text className={styles.infoText}>{currentItem.checkMethod}</Text>
          </View>

          <View className={styles.infoBlock}>
            <Text className={styles.infoLabel}>合格标准</Text>
            <Text className={styles.infoText}>{currentItem.standard}</Text>
          </View>
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>拍照留档</Text>
          {photo ? (
            <View className={styles.photoPreview}>
              <Image
                className={styles.photoImage}
                src={photo}
                mode="aspectFill"
              />
              <View className={styles.photoTag}>
                <Text className={styles.photoTagText}>已拍照</Text>
              </View>
              <Button className={styles.removePhotoBtn} onClick={handleRemovePhoto}>
                ×
              </Button>
            </View>
          ) : (
            <Button className={styles.photoBtn} onClick={handleTakePhoto}>
              📷 点击拍照
            </Button>
          )}

          <View className={styles.remarkSection}>
            <Textarea
              className={styles.remarkInput}
              placeholder="备注信息（可选）"
              value={remark}
              onInput={(e) => setRemark(e.detail.value)}
              maxlength={200}
            />
          </View>
        </View>
      </View>

      <View className={styles.bottomBar}>
        <Button
          className={styles.navBtn}
          onClick={isFirstItem ? handleBack : navigateToPrev}
        >
          {isFirstItem ? '退出' : '上一项'}
        </Button>

        <View className={styles.actionBtns}>
          <Button
            className={classnames(styles.actionBtn, styles.skipBtn)}
            onClick={() => handleStatusSelect('skipped')}
            disabled={isSubmitting}
          >
            跳过
          </Button>
          <Button
            className={classnames(styles.actionBtn, styles.failBtn)}
            onClick={() => handleStatusSelect('failed')}
            disabled={isSubmitting}
          >
            异常
          </Button>
          <Button
            className={classnames(styles.actionBtn, styles.passBtn)}
            onClick={() => handleStatusSelect('passed')}
            disabled={isSubmitting || (tempBlocked && !state.matchingVerified && itemKey === 'precooling')}
          >
            通过
          </Button>
        </View>
      </View>
    </View>
  );
};

export default InspectionDetailPage;
