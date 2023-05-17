import {NativeModules} from 'react-native';

NativeModules.RNIapModule = {
  ...NativeModules.RNIapModule,
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(),
  getInstallSource: jest.fn(),
};
