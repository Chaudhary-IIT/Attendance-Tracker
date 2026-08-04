import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loader } from '../src/components/ui';
import { ensureAndroidChannel } from '../src/lib/notifications';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function RootLayout() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);

  React.useEffect(() => {
    hydrate();
    ensureAndroidChannel().catch(() => {
      /* channel setup is best-effort; permissions are requested later */
    });
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {!hydrated ? (
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <Loader />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="course/[id]"
              options={{ presentation: 'card', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="add-course" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="slots" />
            <Stack.Screen name="backfill" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="one-off" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="slot/[id]" />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
