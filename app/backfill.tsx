import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClassCard } from '../src/components/ClassCard';
import { Button, Card, EmptyState, Squish, Txt } from '../src/components/ui';
import {
  DAY_NAMES,
  addDays,
  classesOn,
  dateKey,
  teachingDatesBetween,
} from '../src/lib/schedule';
import { useScheduleInput, useStore } from '../src/store';
import { radius, space, type Theme } from '../src/theme';
import { useColors, useThemedStyles } from '../src/theme-context';

const RANGE_PRESETS = [
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 },
  { label: '4 months', days: 120 },
];

/**
 * Walks backwards-filled attendance one teaching day at a time.
 *
 * Days with no classes are skipped entirely — only dates that actually have
 * something to mark enter the queue, so a 4-month range is still a short walk.
 */
export default function BackfillScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const input = useScheduleInput();
  const setMark = useStore((s) => s.setMark);
  const settings = input.settings;

  const [rangeDays, setRangeDays] = React.useState(30);
  const [started, setStarted] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  const today = React.useMemo(() => new Date(), []);

  // Honour semesterStart: never offer to backfill before the term began.
  const from = React.useMemo(() => {
    const byRange = addDays(today, -rangeDays);
    if (!settings.semesterStart) return byRange;
    const termStart = new Date(
      Number(settings.semesterStart.slice(0, 4)),
      Number(settings.semesterStart.slice(5, 7)) - 1,
      Number(settings.semesterStart.slice(8, 10)),
    );
    return termStart.getTime() > byRange.getTime() ? termStart : byRange;
  }, [rangeDays, settings.semesterStart, today.toDateString()]);

  const dates = React.useMemo(
    () => teachingDatesBetween(from, today, input),
    [from.toDateString(), today.toDateString(), input],
  );

  const current = dates[index];
  const dayClasses = React.useMemo(
    () => (current ? classesOn(current, input) : []),
    [current?.toDateString(), input],
  );

  const unmarkedCount = React.useMemo(() => {
    let n = 0;
    for (const d of dates) {
      for (const c of classesOn(d, input)) if (c.status == null) n++;
    }
    return n;
  }, [dates, input]);

  const markWholeDay = (status: 'present' | 'absent' | 'cancelled') => {
    for (const c of dayClasses) {
      setMark(c.course.id, c.date, c.meeting.id, status);
    }
  };

  const goNext = () => setIndex((i) => Math.min(dates.length, i + 1));
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  /* ------------------------------------------------------------- set-up -- */

  if (!started) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.lg,
          paddingBottom: insets.bottom + space.xxl,
        }}
      >
        <View style={styles.header}>
          <Squish onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
            <Txt variant="h3" color={colors.textDim}>
              ‹
            </Txt>
          </Squish>
          <View style={{ flex: 1 }}>
            <Txt variant="h2">Backfill attendance</Txt>
            <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
              CATCH UP ON PAST CLASSES
            </Txt>
          </View>
        </View>

        <Txt variant="body" color={colors.textDim} style={{ marginTop: space.xl, lineHeight: 22 }}>
          Pick how far back to go. You'll step through one day at a time, and days with no classes
          are skipped automatically.
        </Txt>

        <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: space.xl, marginBottom: space.md }}>
          HOW FAR BACK
        </Txt>
        <View style={styles.presetRow}>
          {RANGE_PRESETS.map((p) => {
            const on = p.days === rangeDays;
            return (
              <Squish
                key={p.days}
                scaleTo={0.93}
                onPress={() => setRangeDays(p.days)}
                style={[styles.preset, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}
              >
                <Txt variant="small" color={on ? colors.onAccent : colors.textDim}>
                  {p.label}
                </Txt>
              </Squish>
            );
          })}
        </View>

        <Card padded style={{ marginTop: space.xl }}>
          <View style={styles.statRow}>
            <Txt variant="small" color={colors.textFaint}>
              Teaching days in range
            </Txt>
            <Txt variant="h3">{dates.length}</Txt>
          </View>
          <View style={[styles.statRow, { marginTop: space.md }]}>
            <Txt variant="small" color={colors.textFaint}>
              Classes still unmarked
            </Txt>
            <Txt variant="h3" color={unmarkedCount > 0 ? colors.warn : colors.present}>
              {unmarkedCount}
            </Txt>
          </View>
          {settings.semesterStart ? (
            <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: space.md, letterSpacing: 0 }}>
              Limited by your semester start date ({settings.semesterStart}).
            </Txt>
          ) : null}
        </Card>

        {dates.length === 0 ? (
          <Txt variant="small" color={colors.textFaint} center style={{ marginTop: space.xl }}>
            No classes found in this range. Add courses, or widen the range.
          </Txt>
        ) : (
          <Button
            label={`Start · ${dates.length} day${dates.length === 1 ? '' : 's'}`}
            onPress={() => {
              setIndex(0);
              setStarted(true);
            }}
            style={{ marginTop: space.xl }}
          />
        )}
      </ScrollView>
    );
  }

  /* ------------------------------------------------------------ finished -- */

  if (index >= dates.length) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          icon="🎉"
          title="All caught up"
          body={`You went through ${dates.length} teaching day${dates.length === 1 ? '' : 's'}. Your percentages now reflect the whole period.`}
          actionLabel="Done"
          onAction={() => router.back()}
        />
        <Button
          label="Go through it again"
          tone="ghost"
          onPress={() => setIndex(0)}
          style={{ marginHorizontal: space.lg }}
        />
      </View>
    );
  }

  /* --------------------------------------------------------- walkthrough -- */

  const allMarked = dayClasses.every((c) => c.status != null);
  const progress = ((index + 1) / dates.length) * 100;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <Squish onPress={() => setStarted(false)} style={styles.iconBtn} scaleTo={0.9}>
          <Txt variant="h3" color={colors.textDim}>
            ‹
          </Txt>
        </Squish>
        <View style={{ flex: 1 }}>
          <Txt variant="h3">
            Day {index + 1} of {dates.length}
          </Txt>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
        <Squish onPress={() => router.back()} hitSlop={10} style={{ paddingHorizontal: space.sm }}>
          <Txt variant="small" color={colors.accent}>
            Exit
          </Txt>
        </Squish>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: insets.bottom + 190,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(240)} key={dateKey(current)}>
          <Card padded style={styles.dayHead}>
            <Txt variant="h1">{DAY_NAMES[current.getDay()]}</Txt>
            <Txt variant="small" color={colors.textDim} style={{ marginTop: 3 }}>
              {current.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Txt>
            <Txt variant="tiny" color={allMarked ? colors.present : colors.warn} style={{ marginTop: space.sm }}>
              {allMarked
                ? '✓ ALL MARKED'
                : `${dayClasses.filter((c) => c.status == null).length} LEFT TO MARK`}
            </Txt>
          </Card>

          {dayClasses.map((c) => (
            <ClassCard key={c.key} instance={c} />
          ))}

          <Squish
            scaleTo={0.97}
            onPress={() => router.push(`/one-off?date=${dateKey(current)}`)}
            style={styles.addExtra}
          >
            <Txt variant="small" color={colors.textDim}>
              + Add an extra class on this day
            </Txt>
          </Squish>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeIn}
        style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}
      >
        <View style={styles.bulkRow}>
          <Squish
            scaleTo={0.94}
            haptic="success"
            onPress={() => markWholeDay('present')}
            style={[styles.bulkBtn, { backgroundColor: colors.presentSoft, borderColor: `${colors.present}44` }]}
          >
            <Txt variant="small" color={colors.present}>
              ✓ All present
            </Txt>
          </Squish>
          <Squish
            scaleTo={0.94}
            haptic="light"
            onPress={() => markWholeDay('cancelled')}
            style={[styles.bulkBtn, { backgroundColor: colors.cancelledSoft, borderColor: `${colors.cancelled}44` }]}
          >
            <Txt variant="small" color={colors.cancelled}>
              ⊘ All cancelled
            </Txt>
          </Squish>
        </View>

        <View style={styles.navRow}>
          <Squish
            scaleTo={0.94}
            onPress={goPrev}
            style={[styles.navAction, { opacity: index === 0 ? 0.35 : 1 }]}
          >
            <Txt variant="small" color={colors.textDim}>
              ‹ Back
            </Txt>
          </Squish>
          <Squish
            scaleTo={0.96}
            haptic="medium"
            onPress={goNext}
            style={[styles.nextAction, allMarked && { backgroundColor: colors.present }]}
          >
            <Txt variant="h3" color={colors.onAccent}>
              {allMarked ? 'Next day ›' : 'Skip day ›'}
            </Txt>
          </Squish>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: { flexDirection: 'row', gap: 7 },
  preset: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceHi,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 4, backgroundColor: colors.accent },
  dayHead: { marginBottom: space.lg, alignItems: 'flex-start' },
  addExtra: {
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: space.sm,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  bulkRow: { flexDirection: 'row', gap: space.sm },
  bulkBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  navRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  navAction: {
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
  },
  nextAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
});
