import '../../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import Stack from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/feedback/offline-banner';
import { SessionLifecycle } from '@/lib/store/SessionLifecycle';
import { StoreProvider } from '@/lib/store/StoreProvider';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StoreProvider>
          <SessionLifecycle />
          <StatusBar style="auto" />
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false }} />
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
