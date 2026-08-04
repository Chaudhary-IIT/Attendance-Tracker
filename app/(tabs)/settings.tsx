import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, NavRow, Stepper, TimeField, ToggleRow } from '../../src/components/forms';
import { Button, Card, SectionHeader, Txt } from '../../src/components/ui';
import { exportBackupJson, exportTimetablePdf } from '../../src/lib/export';
import { requestPermission } from '../../src/lib/notifications';
import { dateKey } from '../../src/lib/schedule';
import { selectScheduleInput, useStore } from '../../src/store';
import { colors, space } from '../../src/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const input = useStore(selectScheduleInput);
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
        <View style={{ marginTop: space.lg }}>
          <Field label="Reminder time" hint="Pick a time after your last class usually ends.">
            <TimeField
              value={settings.reminderTime}
              onChange={(v) => updateSettings({ reminderTime: v })}
            />
          </Field>
        </View>
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
      <SectionHeader title="Feel" />
      <Card padded={false}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
