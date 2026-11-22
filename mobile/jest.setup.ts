import * as matchers from '@testing-library/react-native/matchers';
import { NativeModules } from 'react-native';

expect.extend(matchers);

// jest-expo stubbe RNCNetInfo.getCurrentState() avec Promise.resolve(undefined) : configurer avant l'import de NetInfo.
if (NativeModules.RNCNetInfo) {
  NativeModules.RNCNetInfo.getCurrentState = () =>
    Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { isConnectionExpensive: false },
    });
}

const NetInfo = require('@react-native-community/netinfo')
  .default as typeof import('@react-native-community/netinfo').default;
NetInfo.configure({ reachabilityShouldRun: () => false });
