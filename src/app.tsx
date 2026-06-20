import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { InspectionProvider } from './store/inspection.context';
import './app.scss';

function App(props) {
  useEffect(() => {});

  useDidShow(() => {});

  useDidHide(() => {});

  return (
    <InspectionProvider>
      {props.children}
    </InspectionProvider>
  );
}

export default App;
