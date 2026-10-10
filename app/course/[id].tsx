import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ColorPicker,
  DayPicker,
  Field,
  Stepper,
  TextField,
  TimeField,
  ToggleRow,
} from '../../src/components/forms';
import { Button, Card, Ring, SectionHeader, Squish, Txt } from '../../src/components/ui';
import {
  DAY_SHORT,
  addDays,
  courseMeetings,
  dateKey,
  findSlot,
  inheritedMeetings,
  formatTime,
  parseDateKey,
  statsFor,
} from '../../src/lib/schedule';
import { uid, useStore } from '../../src/store';
import { healthColor, radius, space, type Theme } from '../../src/theme';
import { useColors, useTheme, useThemedStyles } from '../../src/theme-context';
import type { DayIndex, Meeting } from '../../src/types';

export default function CourseScreen() {
  const colors = useColors();
  const { paletteAt } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const course = useStore((s) => s.courses.find((c) => c.id === id));
  const slots = useStore((s) => s.slots);
  const marks = useStore((s) => s.marks);
  const settings = useStore((s) => s.settings);
  const updateCourse = useStore((s) => s.updateCourse);
  const deleteCourse = useStore((s) => s.deleteCourse);
  const clearMarksFor = useStore((s) => s.clearMarksFor);

  // Start new courses in edit mode — they were just created and need filling in.
  const [editing, setEditing] = React.useState(created === '1');

  if (!course) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.xxl, alignItems: 'center' }]}>
        <Txt variant="h2">Course not found</Txt>
        <Button label="Go back" tone="ghost" onPress={() => router.back()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  const entry = paletteAt(course.colorIndex);
  const stats = statsFor(course, marks, settings);
  const health = healthColor(stats.percent, stats.threshold, colors);
  const slot = findSlot(course, slots);
  const meetings = courseMeetings(course, slots);
  const inherited = inheritedMeetings(course, slots);

  const patch = (p: Parameters<typeof updateCourse>[1]) => updateCourse(course.id, p);

  const addExtraMeeting = () => {
    const meeting: Meeting = { id: uid('mt'), day: 1, start: '09:00', end: '09:50' };
    patch({ extraMeetings: [...course.extraMeetings, meeting] });
  };

  const updateExtra = (mid: string, p: Partial<Meeting>) =>
    patch({
      extraMeetings: course.extraMeetings.map((m) => (m.id === mid ? { ...m, ...p, id: mid } : m)),
    });

  const removeExtra = (mid: string) =>
    patch({ extraMeetings: course.extraMeetings.filter((m) => m.id !== mid) });

  const confirmDelete = () =>
    Alert.alert(
      'Delete course?',
      `"${course.name}" and its ${stats.present + stats.absent + stats.cancelled} attendance records will be removed. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCourse(course.id);
            router.back();
          },
        },
      ],
    );

  const confirmReset = () =>
    Alert.alert('Reset attendance?', 'Clears every mark for this course but keeps the course.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => clearMarksFor(course.id) },
    ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl * 2 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ---------------------------------------------------------- header -- */}
      <View style={[styles.hero, { paddingTop: insets.top + space.md }]}>
        <View style={[styles.heroGlow, { backgroundColor: entry.glow }]} />

        <View style={styles.heroNav}>
          <Squish onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
            <Txt variant="h3" color={colors.textDim}>
              ‹
            </Txt>
          </Squish>
          <View style={{ flex: 1 }} />
          <Squish
            onPress={() => setEditing((v) => !v)}
            haptic="medium"
            style={[styles.editBtn, editing && { backgroundColor: colors.accent }]}
          >
            <Txt variant="small" color={editing ? colors.onAccent : colors.accent}>
              {editing ? 'Done' : 'Edit'}
            </Txt>
          </Squish>
        </View>

        <View style={styles.heroBody}>
          <Txt variant="tiny" color={entry.base}>
            {course.code}
            {slot ? ` · ${slot.name}` : ''}
          </Txt>
          <Txt variant="h1" style={{ marginTop: 6 }}>
            {course.name}
          </Txt>
          {course.faculty || course.room ? (
            <Txt variant="small" color={colors.textDim} style={{ marginTop: 6 }}>
              {[course.faculty, course.room, course.campus && `${course.campus} Campus`]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: space.lg }}>
        {/* --------------------------------------------------------- stats -- */}
        <Card padded={false} style={{ marginTop: space.lg }}>
          <View style={styles.statsInner}>
            <Ring percent={stats.percent} size={110} stroke={11} color={health}>
              <Txt variant="h2" color={health}>
                {stats.percent == null ? '—' : `${Math.round(stats.percent)}%`}
              </Txt>
              <Txt variant="tiny" color={colors.textFaint}>
                OF {stats.threshold}%
              </Txt>
            </Ring>

            <View style={{ flex: 1, gap: space.md }}>
              <StatLine label="Present" value={stats.present} color={colors.present} />
              <StatLine label="Absent" value={stats.absent} color={colors.absent} />
              <StatLine label="Cancelled" value={stats.cancelled} color={colors.cancelled} />
            </View>
          </View>

          <View style={[styles.verdict, { backgroundColor: `${health}14`, borderTopColor: colors.border }]}>
            <Txt variant="small" color={health} center>
              {stats.held === 0
                ? 'No classes marked yet — start with today.'
                : stats.percent != null && stats.percent >= stats.threshold
                  ? stats.canSkip > 0
                    ? `You can miss ${stats.canSkip} more class${stats.canSkip === 1 ? '' : 'es'} and stay above ${stats.threshold}%.`
                    : `Right on the line. Missing even one drops you below ${stats.threshold}%.`
                  : `Attend the next ${stats.mustAttend} class${stats.mustAttend === 1 ? '' : 'es'} in a row to get back to ${stats.threshold}%.`}
            </Txt>
          </View>
        </Card>

        {/* ------------------------------------------------------ schedule -- */}
        <SectionHeader title={`Schedule · ${meetings.length}× a week`} />
        {meetings.length === 0 ? (
          <Card padded>
            <Txt variant="small" color={colors.textDim}>
              No meetings yet. Attach a slot below, or add your own timings.
            </Txt>
          </Card>
        ) : (
          <Card padded={false}>
            {meetings.map((mt, i) => (
              <View
                key={mt.id}
                style={[styles.meetingRow, i === meetings.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={[styles.dayChip, { backgroundColor: `${entry.base}1F` }]}>
                  <Txt variant="tiny" color={entry.base}>
                    {DAY_SHORT[mt.day].toUpperCase()}
                  </Txt>
                </View>
                <Txt variant="body" style={{ flex: 1 }}>
                  {formatTime(mt.start)} – {formatTime(mt.end)}
                </Txt>
                {mt.label ? (
                  <Txt variant="tiny" color={colors.textFaint}>
                    {mt.label}
                  </Txt>
                ) : null}
                {mt.room || course.room ? (
                  <Txt variant="small" color={colors.textDim}>
                    {mt.room || course.room}
                  </Txt>
                ) : null}
              </View>
            ))}
          </Card>
        )}

        {slot ? (
          <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: space.sm, letterSpacing: 0 }}>
            Times come from {slot.name}. Editing them in Settings › Time slots updates every course
            in that slot.
          </Txt>
        ) : null}

        {/* ---------------------------------------------------------- edit -- */}
        {editing ? (
          <Animated.View entering={FadeInDown.duration(260)} layout={Layout.springify()}>
            <SectionHeader title="Details" />
            <Field label="Course code">
              <TextField
                value={course.code}
                onChange={(v) => patch({ code: v })}
                autoCapitalize="characters"
                placeholder="CS-313"
              />
            </Field>
            <Field label="Course name">
              <TextField
                value={course.name}
                onChange={(v) => patch({ name: v })}
                placeholder="Computer Networks"
              />
            </Field>
            <Field label="Faculty">
              <TextField
                value={course.faculty}
                onChange={(v) => patch({ faculty: v })}
                placeholder="Instructor name"
              />
            </Field>
            <Field label="Room / venue" hint="Used for every meeting unless a meeting overrides it.">
              <TextField
                value={course.room}
                onChange={(v) => patch({ room: v })}
                autoCapitalize="characters"
                placeholder="A13-1A"
              />
            </Field>
            <Field label="Campus">
              <TextField value={course.campus} onChange={(v) => patch({ campus: v })} placeholder="North" />
            </Field>

            <Field label="Credits">
              <Stepper
                value={course.credits}
                onChange={(v) => patch({ credits: v })}
                min={0}
                max={24}
                step={1}
              />
            </Field>

            <Field label="Colour">
              <ColorPicker value={course.colorIndex} onChange={(i) => patch({ colorIndex: i })} />
            </Field>

            <SectionHeader title="Slot" />
            <Txt variant="tiny" color={colors.textFaint} style={{ marginBottom: space.md, letterSpacing: 0 }}>
              Attaching a slot pulls in its weekly timings automatically.
            </Txt>
            <View style={styles.slotGrid}>
              <Squish
                scaleTo={0.92}
                onPress={() => patch({ slotKey: null })}
                style={[styles.slotChip, course.slotKey == null && styles.slotChipActive]}
              >
                <Txt variant="tiny" color={course.slotKey == null ? colors.onAccent : colors.textDim}>
                  NONE
                </Txt>
              </Squish>
              {slots.map((s) => {
                const active = course.slotKey === s.key;
                const sc = paletteAt(s.colorIndex);
                return (
                  <Squish
                    key={s.id}
                    scaleTo={0.92}
                    onPress={() => patch({ slotKey: s.key })}
                    style={[
                      styles.slotChip,
                      active && { backgroundColor: sc.base, borderColor: sc.base },
                    ]}
                  >
                    <Txt variant="tiny" color={active ? colors.onAccent : colors.textDim}>
                      {s.key}
                    </Txt>
                  </Squish>
                );
              })}
            </View>

            {slot ? (
              <>
                <SectionHeader title={`Sessions from ${slot.name}`} />
                <Txt
                  variant="tiny"
                  color={colors.textFaint}
                  style={{ marginBottom: space.md, letterSpacing: 0 }}
                >
                  Turn off any session this course doesn't actually attend. This affects only this
                  course — {slot.name} itself, and every other course in it, is left alone.
                </Txt>
                {inherited.length === 0 ? (
                  <Card padded>
                    <Txt variant="small" color={colors.textFaint}>
                      {slot.name} has no timings yet.
                    </Txt>
                  </Card>
                ) : (
                  <Card padded={false}>
                    {inherited.map(({ meeting: mt, muted }, i) => (
                      <View
                        key={mt.id}
                        style={[
                          styles.muteRow,
                          i === inherited.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View
                          style={[
                            styles.dayChip,
                            { backgroundColor: muted ? colors.surfaceHi : `${entry.base}1F` },
                          ]}
                        >
                          <Txt variant="tiny" color={muted ? colors.textFaint : entry.base}>
                            {DAY_SHORT[mt.day].toUpperCase()}
                          </Txt>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Txt
                            variant="body"
                            color={muted ? colors.textFaint : colors.text}
                            numberOfLines={1}
                            style={muted ? { textDecorationLine: 'line-through' } : undefined}
                          >
                            {formatTime(mt.start)} – {formatTime(mt.end)}
                          </Txt>
                          {mt.label ? (
                            <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
                              {mt.label}
                            </Txt>
                          ) : null}
                        </View>
                        <Switch
                          value={!muted}
                          onValueChange={(on) =>
                            patch({
                              mutedMeetingIds: on
                                ? course.mutedMeetingIds.filter((x) => x !== mt.id)
                                : [...course.mutedMeetingIds, mt.id],
                            })
                          }
                          trackColor={{ false: colors.surfaceHi, true: colors.accent }}
                          thumbColor={colors.text}
                        />
                      </View>
                    ))}
                  </Card>
                )}
              </>
            ) : null}

            <SectionHeader title="Extra meetings" action="+ Add" onAction={addExtraMeeting} />
            <Txt variant="tiny" color={colors.textFaint} style={{ marginBottom: space.md, letterSpacing: 0 }}>
              Timings that belong to this course alone — a make-up class, a tutorial, or the whole
              schedule if it has no slot.
            </Txt>
            {course.extraMeetings.length === 0 ? (
              <Card padded>
                <Txt variant="small" color={colors.textFaint}>
                  None. Tap “+ Add” above.
                </Txt>
              </Card>
            ) : (
              course.extraMeetings.map((mt) => (
                <Animated.View key={mt.id} entering={FadeInDown.duration(220)} layout={Layout.springify()}>
                  <Card padded style={{ marginBottom: space.md }}>
                    <Field label="Day">
                      <DayPicker value={mt.day} onChange={(d: DayIndex) => updateExtra(mt.id, { day: d })} />
                    </Field>
                    <View style={{ flexDirection: 'row', gap: space.md }}>
                      <View style={{ flex: 1 }}>
                        <Field label="Starts">
                          <TimeField value={mt.start} onChange={(v) => updateExtra(mt.id, { start: v })} />
                        </Field>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label="Ends">
                          <TimeField value={mt.end} onChange={(v) => updateExtra(mt.id, { end: v })} />
                        </Field>
                      </View>
                    </View>
                    <Field label="Room override" hint="Leave blank to use the course room.">
                      <TextField
                        value={mt.room ?? ''}
                        onChange={(v) => updateExtra(mt.id, { room: v })}
                        autoCapitalize="characters"
                        placeholder={course.room || 'Room'}
                      />
                    </Field>
                    <Button label="Remove this meeting" tone="danger" onPress={() => removeExtra(mt.id)} />
                  </Card>
                </Animated.View>
              ))
            )}

            <SectionHeader title="Tracking period" />
            <Field
              label="Course started on"
              hint="Classes before this date are not scheduled and never count against you. Move it back to record a course that began earlier, then use Backfill."
            >
              <View style={styles.dateRow}>
                <Squish
                  scaleTo={0.9}
                  onPress={() =>
                    patch({
                      startDate: dateKey(
                        addDays(parseDateKey(course.startDate ?? dateKey(new Date())), -1),
                      ),
                    })
                  }
                  style={styles.dateNav}
                >
                  <Txt variant="h3" color={colors.textDim}>
                    ‹
                  </Txt>
                </Squish>

                <View style={styles.dateBox}>
                  <Txt variant="h3">
                    {parseDateKey(course.startDate ?? dateKey(new Date())).toLocaleDateString(
                      undefined,
                      { day: 'numeric', month: 'short', year: 'numeric' },
                    )}
                  </Txt>
                  <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
                    {DAY_SHORT[
                      parseDateKey(course.startDate ?? dateKey(new Date())).getDay()
                    ].toUpperCase()}
                  </Txt>
                </View>

                <Squish
                  scaleTo={0.9}
                  onPress={() =>
                    patch({
                      startDate: dateKey(
                        addDays(parseDateKey(course.startDate ?? dateKey(new Date())), 1),
                      ),
                    })
                  }
                  style={styles.dateNav}
                >
                  <Txt variant="h3" color={colors.textDim}>
                    ›
                  </Txt>
                </Squish>
              </View>
            </Field>
            <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
              {[
                { label: '−1 week', days: -7 },
                { label: '−1 month', days: -30 },
                { label: 'Today', days: null as number | null },
              ].map((q) => (
                <Squish
                  key={q.label}
                  scaleTo={0.93}
                  onPress={() =>
                    patch({
                      startDate:
                        q.days == null
                          ? dateKey(new Date())
                          : dateKey(
                              addDays(
                                parseDateKey(course.startDate ?? dateKey(new Date())),
                                q.days,
                              ),
                            ),
                    })
                  }
                  style={styles.quickChip}
                >
                  <Txt variant="tiny" color={colors.textDim}>
                    {q.label}
                  </Txt>
                </Squish>
              ))}
            </View>

            <SectionHeader title="Attendance rule" />
            <Field
              label="Minimum attendance"
              hint={
                course.minAttendance == null
                  ? `Following the global target of ${settings.minAttendance}%.`
                  : 'This course only.'
              }
            >
              <Stepper
                value={course.minAttendance ?? settings.minAttendance}
                onChange={(v) => patch({ minAttendance: v })}
                min={0}
                max={100}
                step={5}
                suffix="%"
              />
            </Field>
            {course.minAttendance != null ? (
              <Button
                label={`Use global target (${settings.minAttendance}%)`}
                tone="ghost"
                onPress={() => patch({ minAttendance: null })}
                style={{ marginBottom: space.lg }}
              />
            ) : null}

            <Card padded={false} style={{ marginTop: space.sm }}>
              <ToggleRow
                label="Archive course"
                hint="Hides it from Today and the timetable, but keeps all history."
                value={course.archived}
                onChange={(v) => patch({ archived: v })}
              />
            </Card>

            <SectionHeader title="Danger zone" />
            <Button label="Reset attendance history" tone="danger" onPress={confirmReset} />
            <Button
              label="Delete course"
              tone="danger"
              onPress={confirmDelete}
              style={{ marginTop: space.md }}
            />
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function StatLine({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Txt variant="small" color={colors.textFaint}>
        {label}
      </Txt>
      <Txt variant="h3" color={color}>
        {value}
      </Txt>
    </View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: {
    backgroundColor: colors.bgElevated,
    paddingBottom: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', top: -120, right: -80, width: 280, height: 280, borderRadius: 140 },
  heroNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg },
  heroBody: { paddingHorizontal: space.lg, marginTop: space.lg },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  statsInner: { flexDirection: 'row', alignItems: 'center', gap: space.xl, padding: space.lg },
  verdict: { paddingVertical: space.md, paddingHorizontal: space.lg, borderTopWidth: 1 },
  meetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 42, alignItems: 'center' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  muteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 11,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateNav: {
    width: 44,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
  },
});
