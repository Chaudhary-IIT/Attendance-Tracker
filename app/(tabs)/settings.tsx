import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, NavRow, Stepper, TimeField, ToggleRow } from '../../src/components/forms';
import { Button, Card, SectionHeader, SegmentedControl, Squish, Txt } from '../../src/components/ui';
import { exportBackupJson, exportTimetablePdf } from '../../src/lib/export';
import {
  notificationHealth,
  requestPermission,
  sendTestNotification,
  type NotificationHealth,
} from '../../src/lib/notifications';
import { dateKey } from '../../src/lib/schedule';
import { useScheduleInput, useStore } from '../../src/store';
import { radius, space, type Theme } from '../../src/theme';
import { useColors, useTheme, useThemedStyles } from '../../src/theme-context';

export default function SettingsScreen() {
  const colors = useColors();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const input = useScheduleInput();
  const { courses, slots, marks, settings, oneOffs } = input;
  const updateSettings = useStore((s) => s.updateSettings);
  const toggleHoliday = useStore((s) => s.toggleHoliday);
  const resetAll = useStore((s) => s.resetAll);

  const today = dateKey(new Date());
  const isHolidayToday = settings.holidays.includes(today);
  const markCount = Object.keys(marks).length;

  const onToggleReminder = async (v: boolean) => {
    if (v) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Notifications are off',
          'Enable notifications for this app in your phone settings, then turn the reminder back on.',
        );
        return;
      }
    }
    updateSettings({ reminderEnabled: v });
  };

  const confirmReset = () =>
    Alert.alert(
      'Erase everything?',
      `All ${courses.length} courses and ${markCount} attendance records will be deleted, and slots reset to the institute defaults.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => resetAll() },
      ],
    );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: 130,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Txt variant="h1">Settings</Txt>
      <Txt variant="small" color={colors.textFaint} style={{ marginTop: 2 }}>
        {courses.length} courses · {slots.length} slots · {markCount} records
      </Txt>

      {/* ------------------------------------------------------- reminders -- */}
      <SectionHeader title="Daily reminder" />
      <Card padded={false}>
        <ToggleRow
          label="Evening nudge"
          hint="One notification a day asking you to mark the classes you attended."
          value={settings.reminderEnabled}
          onChange={onToggleReminder}
        />
        <ToggleRow
          label="Skip empty days"
          hint="Stay quiet on days with nothing scheduled."
          value={settings.reminderSkipEmptyDays}
          onChange={(v) => updateSettings({ reminderSkipEmptyDays: v })}
        />
      </Card>

      {settings.reminderEnabled ? (
        <>
          <View style={{ marginTop: space.lg }}>
            <Field label="Reminder time" hint="Pick a time after your last class usually ends.">
              <TimeField
                value={settings.reminderTime}
                onChange={(v) => updateSettings({ reminderTime: v })}
              />
            </Field>
          </View>
          <NotificationHealthCard />
        </>
      ) : null}

      {/* ------------------------------------------------------ attendance -- */}
      <SectionHeader title="Attendance" />
      <Field
        label="Minimum attendance target"
        hint="The institute default is 75%. Individual courses can override this."
      >
        <Stepper
          value={settings.minAttendance}
          onChange={(v) => updateSettings({ minAttendance: v })}
          min={0}
          max={100}
          step={5}
          suffix="%"
        />
      </Field>

      {/* ----------------------------------------------------------- slots -- */}
      <SectionHeader title="Schedule" />
      <Card padded={false}>
        <NavRow
          label="Time slots"
          hint="Define when each slot meets. Nothing is hardcoded — edit, add or delete freely."
          value={`${slots.length}`}
          onPress={() => router.push('/slots')}
        />
        <NavRow
          label="Free classrooms"
          hint="See which rooms are occupied right now, or at any time you pick."
          onPress={() => router.push('/rooms')}
        />
        <NavRow
          label="Backfill attendance"
          hint="Step through past teaching days and mark what you already attended."
          onPress={() => router.push('/backfill')}
        />
        <NavRow
          label="Add an extra class"
          hint="A one-off make-up or rescheduled class on a single date."
          value={oneOffs.length ? `${oneOffs.length}` : undefined}
          onPress={() => router.push('/one-off')}
        />
        <ToggleRow
          label="Today is a holiday"
          hint="Hides today's classes and leaves them out of your percentages."
          value={isHolidayToday}
          onChange={() => toggleHoliday(today)}
        />
      </Card>

      {settings.holidays.length > 0 ? (
        <Card padded style={{ marginTop: space.md }}>
          <Txt variant="tiny" color={colors.textFaint}>
            {settings.holidays.length} HOLIDAY{settings.holidays.length === 1 ? '' : 'S'} MARKED
          </Txt>
          <Txt variant="small" color={colors.textDim} style={{ marginTop: 6, lineHeight: 20 }}>
            {settings.holidays.slice(-8).join('  ·  ')}
          </Txt>
          <Button
            label="Clear all holidays"
            tone="ghost"
            onPress={() => updateSettings({ holidays: [] })}
            style={{ marginTop: space.md }}
          />
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ feel -- */}
      <SectionHeader title="Appearance" />
      <SegmentedControl
        value={settings.themePref}
        onChange={(v) => updateSettings({ themePref: v })}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
      <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 8, letterSpacing: 0 }}>
        {settings.themePref === 'system'
          ? `Following your phone — currently ${scheme}.`
          : `Always ${settings.themePref}, whatever the phone is set to.`}
      </Txt>

      <Card padded={false} style={{ marginTop: space.lg }}>
        <ToggleRow
          label="Haptics"
          hint="Vibration feedback when you mark a class."
          value={settings.hapticsEnabled}
          onChange={(v) => updateSettings({ hapticsEnabled: v })}
        />
      </Card>

      {/* ------------------------------------------------------------ data -- */}
      <SectionHeader title="Data" />
      <Button
        label="Export timetable as PDF"
        tone="ghost"
        onPress={async () => {
          const res = await exportTimetablePdf(courses, slots, marks, settings);
          if (!res.ok) Alert.alert('Export', res.message);
        }}
      />
      <Button
        label="Export full backup (JSON)"
        tone="ghost"
        onPress={async () => {
          const res = await exportBackupJson({ courses, slots, marks, settings, oneOffs });
          if (!res.ok) Alert.alert('Backup', res.message);
        }}
        style={{ marginTop: space.md }}
      />
      <Button
        label="Erase all data"
        tone="danger"
        onPress={confirmReset}
        style={{ marginTop: space.md }}
      />

      <Txt variant="tiny" color={colors.textFaint} center style={{ marginTop: space.xxl, letterSpacing: 0 }}>
        Everything stays on this device. No account, no sync, no network.
      </Txt>
    </ScrollView>
  );
}

/* --------------------------------------------------- notification health -- */

/**
 * "My reminders never arrive" has three completely different causes that all
 * look identical from inside the app: permission denied, the Android channel
 * silenced by the user, or nothing armed yet. None of them make an API call
 * fail, so the only honest fix is to show which one is true and let the user
 * prove delivery with a real notification.
 */
function NotificationHealthCard() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [health, setHealth] = React.useState<NotificationHealth | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => {
    notificationHealth()
      .then(setHealth)
      .catch((err) => console.warn('[notifications] health check failed', err));
  }, []);

  // Re-check on focus: the user may have just left for system settings.
  useFocusEffect(refresh);

  const onTest = async () => {
    setBusy(true);
    const res = await sendTestNotification();
    setBusy(false);
    Alert.alert(res.ok ? 'Test sent' : 'Could not send test', res.message);
    refresh();
  };

  if (!health) return null;

  const blocked = !health.granted || health.channelBlocked;

  const [tone, label, detail] = health.channelBlocked
    ? ([colors.warn, 'REMINDERS SILENCED', 'The app is allowed to notify you, but the "Attendance reminders" channel is switched off in Android settings. Turn it back on there.'] as const)
    : !health.granted
      ? ([
          colors.absent,
          'NOT ALLOWED',
          health.canAskAgain
            ? 'Android has not granted notification permission yet. Send a test to trigger the prompt.'
            : 'Notification permission was denied. Only system settings can re-enable it.',
        ] as const)
      : health.pendingDaily === 0
        ? ([
            colors.textDim,
            'NOTHING QUEUED',
            'No nudges are armed. With "skip empty days" on, this is normal when you have no classes in the next two weeks.',
          ] as const)
        : ([
            colors.present,
            'ARMED',
            `${health.pendingDaily} nudge${health.pendingDaily === 1 ? '' : 's'} queued${
              health.nextFireAt
                ? `, next on ${health.nextFireAt.toLocaleDateString(undefined, {
                    weekday: 'short',
                  })} at ${health.nextFireAt.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : ''
            }.${health.pendingPing > 0 ? ' A class ping is also set.' : ''} If one still never arrives, the phone is putting this app to sleep — allow unrestricted battery usage below.`,
          ] as const);

  return (
    <Card padded style={{ marginTop: space.xs }}>
      <View style={styles.healthTop}>
        <View style={[styles.healthDot, { backgroundColor: tone }]} />
        <Txt variant="tiny" color={tone}>
          {label}
        </Txt>
        <View style={{ flex: 1 }} />
        <Squish onPress={refresh} hitSlop={10}>
          <Txt variant="tiny" color={colors.textFaint}>
            RECHECK
          </Txt>
        </Squish>
      </View>

      <Txt variant="small" color={colors.textDim} style={{ marginTop: 8, lineHeight: 19 }}>
        {detail}
      </Txt>

      <View style={styles.healthActions}>
        <Button
          label={busy ? 'Sending…' : 'Send a test'}
          tone="ghost"
          disabled={busy}
          onPress={onTest}
          style={{ flex: 1 }}
        />
        {blocked ? (
          <Button
            label="System settings"
            tone="ghost"
            onPress={() => Linking.openSettings()}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>

      {/*
        Exact alarms are granted at install now, but an OEM can still park the
        whole app in a sleep bucket, which cancels its alarms outright. That is
        invisible to every API we can call, so the only remedy is to hand the
        user the settings page and say plainly what to look for.
      */}
      {Platform.OS === 'android' ? (
        <Button
          label="Battery settings"
          tone="ghost"
          onPress={() => {
            Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
              Linking.openSettings(),
            );
          }}
          style={{ marginTop: space.sm }}
        />
      ) : null}
    </Card>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  healthTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  healthDot: { width: 7, height: 7, borderRadius: radius.pill },
  healthActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
