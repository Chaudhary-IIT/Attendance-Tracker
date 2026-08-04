import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, type } from '../../src/theme';

const ICONS: Record<string, string> = {
  index: '◎',
  timetable: '▦',
  courses: '◈',
  settings: '⚙',
};

const LABELS: Record<string, string> = {
  index: 'Today',
  timetable: 'Timetable',
  courses: 'Courses',
  settings: 'Settings',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const scale = useSharedValue(focused ? 1 : 0.9);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.9, { damping: 15, stiffness: 250 });
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.tabItem, animStyle]}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Text style={{ fontSize: 17, color: focused ? colors.accent : colors.textFaint }}>
          {ICONS[name]}
        </Text>
      </View>
      <Text
        style={[
          type.tiny,
          { color: focused ? colors.text : colors.textFaint, marginTop: 3, letterSpacing: 0.2 },
        ]}
        numberOfLines={1}
      >
        {LABELS[name]}
      </Text>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: { height: 56 },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="timetable" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: Platform.OS === 'ios' ? 84 : 66,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 8,
    elevation: 0,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: 70 },
  iconWrap: {
    width: 34,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.accentSoft },
});
