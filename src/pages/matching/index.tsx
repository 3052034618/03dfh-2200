import React, { useState, useMemo } from 'react';
import { View, Text, Input, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { WaybillInfo, Task } from '@/types';
import { MOCK_WAYBILLS, MOCK_TASKS } from '@/data/mock';
import { checkTempMatch, getTempZoneConfig } from '@/data/inspection';
import TempZoneTag from '@/components/TempZoneTag';
import { useInspection } from '@/store/inspection.context';

const MatchingPage: React.FC = () => {
  const [waybillNo, setWaybillNo] = useState('');
  const [waybillInfo, setWaybillInfo] = useState<WaybillInfo | null>(null);
  const [currentTemp, setCurrentTemp] = useState('');
  const [verifyResult, setVerifyResult] = useState<'success' | 'error' | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [queryError, setQueryError] = useState('');
  const { setMatchingData, resetInspection, startInspection } = useInspection();

  const matchedTask = useMemo(() => {
    if (!waybillInfo) return null;
    return MOCK_TASKS.find(t => t.waybillNo === waybillInfo.waybillNo) || null;
  }, [waybillInfo]);

  const handleScan = async () => {
    try {
      const result = await Taro.scanCode({
        scanType: ['barCode', 'qrCode']
      });
      console.log('[MatchingPage] Scan result:', result.result);
      setWaybillNo(result.result);
      setWaybillInfo(null);
      setVerifyResult(null);
      setQueryError('');
    } catch (e) {
      console.error('[MatchingPage] Scan failed:', e);
      Taro.showToast({ title: '扫码失败', icon: 'none' });
    }
  };

  const handleQuery = () => {
    if (!waybillNo.trim()) {
      Taro.showToast({ title: '请输入运单号', icon: 'none' });
      return;
    }

    console.log('[MatchingPage] Query waybill:', waybillNo);
    const info = MOCK_WAYBILLS[waybillNo.trim().toUpperCase()];

    if (info) {
      setWaybillInfo(info);
      setVerifyResult(null);
      setQueryError('');
      console.log('[MatchingPage] Waybill found:', info);
    } else {
      setWaybillInfo(null);
      setVerifyResult(null);
      setQueryError('未找到该运单，请检查运单号是否正确');
      console.warn('[MatchingPage] Waybill not found:', waybillNo);
    }
  };

  const handleVerify = () => {
    if (!waybillInfo) return;
    if (!currentTemp) {
      Taro.showToast({ title: '请输入当前温度', icon: 'none' });
      return;
    }

    const temp = parseFloat(currentTemp);
    if (isNaN(temp)) {
      Taro.showToast({ title: '请输入有效的温度值', icon: 'none' });
      return;
    }

    setIsVerifying(true);
    console.log('[MatchingPage] Verifying temperature:', temp, 'required zone:', waybillInfo.tempZone);

    setTimeout(() => {
      const isMatch = checkTempMatch(temp, waybillInfo.tempZone);
      setVerifyResult(isMatch ? 'success' : 'error');
      setIsVerifying(false);

      if (isMatch) {
        Taro.showToast({ title: '温度匹配成功', icon: 'success' });
        console.log('[MatchingPage] Temperature match SUCCESS');
      } else {
        Taro.vibrateShort();
        console.log('[MatchingPage] Temperature match FAILED');
      }
    }, 800);
  };

  const handleContactWarehouse = () => {
    Taro.makePhoneCall({
      phoneNumber: '400-888-8888',
      fail: (e) => {
        console.error('[MatchingPage] Call failed:', e);
        Taro.showToast({ title: '拨号失败', icon: 'none' });
      }
    });
  };

  const handleStartInspection = () => {
    if (!waybillInfo || verifyResult !== 'success') return;
    
    const temp = parseFloat(currentTemp);
    if (isNaN(temp)) return;

    resetInspection();
    setMatchingData({
      temp: temp,
      waybillNo: waybillInfo.waybillNo,
      tempZone: waybillInfo.tempZone,
      verified: true
    });

    if (matchedTask) {
      startInspection(matchedTask);
      Taro.navigateTo({ url: '/pages/inspection-detail/index?itemKey=precooling' });
    } else {
      Taro.showModal({
        title: '未找到对应任务',
        content: '已记录温区和温度信息，请前往出车检查页面手动选择车辆。',
        confirmText: '前往出车检查',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            Taro.switchTab({ url: '/pages/inspection/index' });
          }
        }
      });
    }
  };

  const handleReset = () => {
    setWaybillNo('');
    setWaybillInfo(null);
    setCurrentTemp('');
    setVerifyResult(null);
    setQueryError('');
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>货品温区匹配</Text>
        <Text className={styles.subtitle}>扫码或输入装车单号，验证温区是否匹配</Text>
      </View>

      <View className={styles.inputSection}>
        <View className={styles.inputRow}>
          <Button className={styles.scanBtn} onClick={handleScan}>
            📷 扫码
          </Button>
          <View className={styles.inputWrapper}>
            <Input
              className={styles.input}
              placeholder="请输入或扫描装车单号"
              value={waybillNo}
              onInput={(e) => {
                setWaybillNo(e.detail.value);
                setQueryError('');
              }}
              onConfirm={handleQuery}
            />
          </View>
        </View>
        <Button
          className={styles.queryBtn}
          onClick={handleQuery}
          disabled={!waybillNo.trim()}
        >
          查询运单
        </Button>
      </View>

      {queryError && (
        <View className={classnames(styles.resultCard, styles.errorCard)}>
          <View className={styles.resultHeader}>
            <Text className={styles.resultIcon}>⚠️</Text>
            <Text className={classnames(styles.resultTitle, styles.errorText)}>查询失败</Text>
          </View>
          <Text className={styles.resultDesc}>{queryError}</Text>
        </View>
      )}

      {waybillInfo && (
        <View className={styles.waybillCard}>
          <View className={styles.cardHeader}>
            <Text className={styles.waybillNo}>运单：{waybillInfo.waybillNo}</Text>
            <TempZoneTag type={waybillInfo.tempZone} showTemp size="sm" />
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>货品名称</Text>
            <Text className={styles.infoValue}>{waybillInfo.goodsName}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>货品重量</Text>
            <Text className={styles.infoValue}>{waybillInfo.weight}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>目标温度</Text>
            <Text className={styles.infoValue}>{waybillInfo.targetTemp}</Text>
          </View>
          {matchedTask && (
            <View className={styles.taskInfoCard}>
              <Text className={styles.taskInfoTitle}>🚚 关联出车任务</Text>
              <View className={styles.taskInfoRow}>
                <Text className={styles.taskInfoLabel}>车牌号</Text>
                <Text className={styles.taskInfoValue}>{matchedTask.plateNumber}</Text>
              </View>
              <View className={styles.taskInfoRow}>
                <Text className={styles.taskInfoLabel}>司机</Text>
                <Text className={styles.taskInfoValue}>{matchedTask.driverName}</Text>
              </View>
              <View className={styles.taskInfoRow}>
                <Text className={styles.taskInfoLabel}>发车时间</Text>
                <Text className={styles.taskInfoValue}>{matchedTask.departureTime}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {waybillInfo && (
        <View className={styles.tempSection}>
          <Text className={styles.sectionTitle}>当前车厢温度</Text>
          <View className={styles.tempInputWrapper}>
            <Input
              className={styles.tempInput}
              type="digit"
              placeholder="--"
              value={currentTemp}
              onInput={(e) => {
                setCurrentTemp(e.detail.value);
                setVerifyResult(null);
              }}
            />
            <Text className={styles.tempUnit}>℃</Text>
          </View>
          <Text className={styles.tempHint}>
            请输入温控面板显示的实际温度（支持负数）
          </Text>
        </View>
      )}

      {waybillInfo && verifyResult && (
        <View
          className={classnames(
            styles.resultCard,
            verifyResult === 'success' ? styles.successCard : styles.errorCard
          )}
        >
          <View className={styles.resultHeader}>
            <Text className={styles.resultIcon}>
              {verifyResult === 'success' ? '✅' : '❌'}
            </Text>
            <Text
              className={classnames(
                styles.resultTitle,
                verifyResult === 'success' ? styles.successText : styles.errorText
              )}
            >
              {verifyResult === 'success' ? '温度匹配成功' : '温度不匹配'}
            </Text>
          </View>
          <Text className={styles.resultDesc}>
            {verifyResult === 'success'
              ? `当前温度 ${currentTemp}℃ 符合${getTempZoneConfig(waybillInfo.tempZone).label}区要求，可以进行出车检查。`
              : `当前温度 ${currentTemp}℃ 不符合${getTempZoneConfig(waybillInfo.tempZone).label}区要求（${waybillInfo.targetTemp}），请联系仓库复核。`}
          </Text>
          {verifyResult === 'error' && (
            <View className={styles.actionRow}>
              <Button className={styles.secondaryBtn} onClick={handleReset}>
                重新输入
              </Button>
              <Button className={styles.primaryBtn} onClick={handleContactWarehouse}>
                📞 联系仓库
              </Button>
            </View>
          )}
        </View>
      )}

      {waybillInfo && !verifyResult && (
        <Button
          className={styles.verifyBtn}
          onClick={handleVerify}
          disabled={!currentTemp || isVerifying}
        >
          {isVerifying ? '验证中...' : '验证温度匹配'}
        </Button>
      )}

      {waybillInfo && verifyResult === 'success' && (
        <View className={styles.startInspectionSection}>
          <Button className={styles.startInspectionBtn} onClick={handleStartInspection}>
            🚀 进入出车检查
          </Button>
          <Text className={styles.startInspectionHint}>
            将带着温区信息和已验证的温度进入检查流程
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default MatchingPage;
