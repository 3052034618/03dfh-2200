import React from 'react';
import { View, Text, Image } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { InspectionItem, CheckStatus } from '@/types';
import StatusBadge from '@/components/StatusBadge';

interface CheckItemCardProps {
  item: InspectionItem;
  index: number;
  status: CheckStatus;
  photo?: string;
  onClick?: () => void;
}

const CheckItemCard: React.FC<CheckItemCardProps> = ({ item, index, status, photo, onClick }) => {
  const statusIcon: Record<CheckStatus, string> = {
    pending: '',
    passed: '✓',
    skipped: '→',
    failed: '✕'
  };

  const handleClick = () => {
    onClick?.();
  };

  return (
    <View
      className={classnames(
        styles.card,
        status === 'passed' && styles.passed,
        status === 'skipped' && styles.skipped,
        status === 'failed' && styles.failed
      )}
      onClick={handleClick}
    >
      <View className={styles.indexBadge}>
        <Text className={styles.indexText}>{index + 1}</Text>
      </View>

      <View className={styles.content}>
        <View className={styles.header}>
          <Text className={styles.title}>{item.title}</Text>
          <StatusBadge status={status} size="sm" />
        </View>

        <Text className={styles.description}>{item.description}</Text>

        <View className={styles.previewRow}>
          <View className={styles.imagePreview}>
            <Image
              className={styles.image}
              src={photo || item.exampleImage}
              mode="aspectFill"
              onError={(e) => console.error('[CheckItemCard] Image load error:', e)}
            />
            {photo && <View className={styles.photoTag}><Text className={styles.photoText}>已拍照</Text></View>}
          </View>

          {status !== 'pending' && (
            <View className={styles.statusIcon}>
              <Text className={styles.iconText}>{statusIcon[status]}</Text>
            </View>
          )}
        </View>
      </View>

      <View className={styles.arrow}>
        <Text className={styles.arrowText}>{'>'}</Text>
      </View>
    </View>
  );
};

export default CheckItemCard;
