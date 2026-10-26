import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import '@/infrastructure/notifications';

initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Models & OpenRouter' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
