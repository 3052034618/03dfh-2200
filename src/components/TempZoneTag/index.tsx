import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { TempZoneType } from '@/types';
import { getTempZoneConfig } from '@/data/inspection';

interface TempZoneTagProps {
  type: TempZoneType;
  showTemp?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const TempZoneTag: React.FC<TempZoneTagProps> = ({ type, showTemp = false, size = 'md' }) => {
  const config = getTempZoneConfig(type);

  return (
    <View
      className={classnames(
        styles.tag,
        styles[type],
        size === 'sm' && styles.small,
        size === 'lg' && styles.large
      )}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.color
      }}
    >
      <Text className={styles.label} style={{ color: config.color }}>
        {config.label}
      </Text>
      {showTemp && (
        <Text className={styles.temp} style={{ color: config.color }}>
          {config.tempRange}
        </Text>
      )}
    </View>
  );
};

export default TempZoneTag;
