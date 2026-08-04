import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClassCard } from '../../src/components/ClassCard';
import { Button, Card, EmptyState, Ring, SectionHeader, Squish, Txt } from '../../src/components/ui';
import { formatCountdown, greeting, useNow } from '../../src/hooks';
import {
  DAY_NAMES,
  classesOn,
  currentClass,
  dateKey,
  formatTime,
  markingStreak,
  nextClass,
  overallStats,
  unmarkedBefore,
} from '../../src/lib/schedule';
import { pingBeforeClass, rescheduleReminders } from '../../src/lib/notifications';
import { selectScheduleInput, useStore } from '../../src/store';
import { colors, healthColor, paletteAt, radius, shadow, space } from '../../src/theme';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow(1000);

  const input = useStore(selectScheduleInput);
  const { courses, settings, marks } = input;

  const today = React.useMemo(() => classesOn(now, input), [input, now.toDateString()]);
  const live = React.useMemo(() => currentClass(now, input), [input, Math.floor(now.getTime() / 30000)]);
  const upcoming = React.useMemo(
    () => nextClass(now, input),
    [input, Math.floor(now.getTime() / 30000)],
  );

  // Only *earlier* days go in the catch-up list; today's classes already have
  // their own section below, and showing a card twice reads as a bug.
  const todayStr = dateKey(now);
  const backlog = React.useMemo(
    () => unmarkedBefore(now, input).filter((c) => c.date !== todayStr),
    [input, todayStr],
  );

  const overall = React.useMemo(() => overallStats(courses, marks, settings), [courses, marks, settings]);
  const streak = React.useMemo(() => markingStreak(now, input), [input, todayStr]);

  const activeCourses = courses.filter((c) => !c.archived);
  const unmarkedToday = today.filter((c) => c.status == null && c.end.getTime() <= now.getTime()).length;

  // Re-arm the rolling reminder window whenever the picture changes, so its
  // wording matches what's actually outstanding.
  React.useEffect(() => {
    rescheduleReminders(settings, input, backlog.length + unmarkedToday).catch((err) =>
      console.warn('[reminders]', err),
    );
  }, [
    settings.reminderEnabled,
    settings.reminderTime,
    settings.reminderSkipEmptyDays,
    backlog.length,
    unmarkedToday,
    todayStr,
  ]);

  const heroTarget = live ?? upcoming;
  const heroColor = heroTarget ? paletteAt(heroTarget.course.colorIndex) : null;
  const overallColor = healthColor(overall.percent, settings.minAttendance);

  if (activeCourses.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          icon="📚"
          title="No courses yet"
          body="Add the courses you're taking this semester. Pick them from the institute catalog and their slot, room and timings fill in automatically."
          actionLabel="Add your first course"
          onAction={() => router.push('/add-course')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: space.xxl * 2 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------------------------------------------------------- header -- */}
      <Animated.View entering={FadeInDown.duration(320)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="small" color={colors.textDim}>
            {greeting(now)}
          </Txt>
          <Txt variant="h1" style={{ marginTop: 2 }}>
            {DAY_NAMES[now.getDay()]}
          </Txt>
          <Txt variant="small" color={colors.textFaint} style={{ marginTop: 3 }}>
            {now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
          </Txt>
        </View>

        {streak > 0 ? (
          <View style={styles.streak}>
            <Txt variant="h2" color={colors.warn}>
              {streak}
            </Txt>
            <Txt variant="tiny" color={colors.textFaint}>
              DAY STREAK
            </Txt>
          </View>
        ) : null}
      </Animated.View>

      {/* ------------------------------------------------------- hero card -- */}
      <Animated.View entering={FadeInDown.duration(340).delay(60)}>
        {heroTarget && heroColor ? (
          <Squish
            scaleTo={0.98}
            haptic="medium"
            onPress={() => router.push('/timetable')}
            style={[styles.hero, { borderColor: `${heroColor.base}40` }, shadow.hero]}
          >
            <View style={[styles.heroGlow, { backgroundColor: heroColor.glow }]} />

            <View style={styles.heroTop}>
              <View style={[styles.heroDot, { backgroundColor: heroColor.base }]} />
              <Txt variant="tiny" color={heroColor.base}>
                {live ? 'HAPPENING NOW' : 'NEXT CLASS'}
              </Txt>
              <View style={{ flex: 1 }} />
              <Txt variant="tiny" color={colors.textFaint}>
                {heroTarget.date === todayStr
                  ? 'TODAY'
                  : DAY_NAMES[heroTarget.start.getDay()].toUpperCase()}
              </Txt>
            </View>

            <Txt variant="display" color={colors.text} style={{ marginTop: space.md }}>
              {live
                ? formatCountdown(heroTarget.end, now).replace('in ', '') + ' left'
                : formatCountdown(heroTarget.start, now)}
            </Txt>

            <Txt variant="h2" style={{ marginTop: space.md }} numberOfLines={2}>
              {heroTarget.course.name}
            </Txt>

            <View style={styles.heroMeta}>
              <Txt variant="small" color={heroColor.base}>
                {heroTarget.course.code}
              </Txt>
              <Txt variant="small" color={colors.textFaint}>
                ·
              </Txt>
              <Txt variant="small" color={colors.textDim}>
                {formatTime(heroTarget.meeting.start)} – {formatTime(heroTarget.meeting.end)}
              </Txt>
              {heroTarget.meeting.room || heroTarget.course.room ? (
                <>
                  <Txt variant="small" color={colors.textFaint}>
                    ·
                  </Txt>
                  <Txt variant="small" color={colors.textDim}>
                    {heroTarget.meeting.room || heroTarget.course.room}
                  </Txt>
                </>
              ) : null}
            </View>

            <View style={styles.heroActions}>
              <Txt variant="tiny" color={colors.textFaint}>
                TAP FOR FULL TIMETABLE →
              </Txt>
              <View style={{ flex: 1 }} />
              {!live ? (
                <Squish
                  haptic="medium"
                  scaleTo={0.92}
                  onPress={async () => {
                    const res = await pingBeforeClass(heroTarget);
                    Alert.alert(res.ok ? 'Reminder set' : 'Could not set reminder', res.message);
                  }}
                  style={[styles.remindBtn, { backgroundColor: `${heroColor.base}22` }]}
                >
                  <Txt variant="tiny" color={heroColor.base}>
                    ⏰ REMIND ME
                  </Txt>
                </Squish>
              ) : null}
            </View>
          </Squish>
        ) : (
          <Card style={styles.hero} padded>
            <Txt variant="h2">Nothing scheduled</Txt>
            <Txt variant="body" color={colors.textDim} style={{ marginTop: space.sm }}>
              No upcoming classes in the next two weeks. If that's wrong, check your slot timings in
              Settings.
            </Txt>
          </Card>
        )}
      </Animated.View>

      {/* --------------------------------------------------------- summary -- */}
      <Animated.View entering={FadeInDown.duration(340).delay(120)}>
        <Card style={styles.summary} padded={false}>
          <View style={styles.summaryInner}>
            <Ring percent={overall.percent} size={104} stroke={10} color={overallColor}>
              <Txt variant="h2" color={overallColor}>
                {overall.percent == null ? '—' : `${Math.round(overall.percent)}%`}
              </Txt>
              <Txt variant="tiny" color={colors.textFaint}>
                OVERALL
              </Txt>
            </Ring>

            <View style={styles.summaryStats}>
              <SummaryRow label="Attended" value={`${overall.present}`} color={colors.present} />
              <SummaryRow label="Classes held" value={`${overall.held}`} color={colors.textDim} />
              <SummaryRow
                label="Below target"
                value={`${overall.atRisk} course${overall.atRisk === 1 ? '' : 's'}`}
                color={overall.atRisk > 0 ? colors.absent : colors.present}
              />
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* --------------------------------------------------------- backlog -- */}
      {backlog.length > 0 ? (
        <>
          <SectionHeader title={`Waiting to be marked · ${backlog.length}`} />
          {backlog.slice(0, 6).map((c) => (
            <ClassCard key={c.key} instance={c} showDate compact />
          ))}
          {backlog.length > 6 ? (
            <Txt variant="small" color={colors.textFaint} center style={{ marginTop: space.sm }}>
              + {backlog.length - 6} older
            </Txt>
          ) : null}
        </>
      ) : null}

      {/* ----------------------------------------------------------- today -- */}
      <SectionHeader title={`Today · ${today.length} class${today.length === 1 ? '' : 'es'}`} />
      {today.length === 0 ? (
        <Card padded style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Txt variant="h2">Free day</Txt>
          <Txt variant="small" color={colors.textDim} center style={{ marginTop: space.sm }}>
            No classes scheduled for {DAY_NAMES[now.getDay()]}.
          </Txt>
        </Card>
      ) : (
        today.map((c) => <ClassCard key={c.key} instance={c} />)
      )}

      <View style={styles.footerActions}>
        <Button
          label="+ Course"
          tone="ghost"
          onPress={() => router.push('/add-course')}
          style={{ flex: 1 }}
        />
        <Button
          label="+ Extra class"
          tone="ghost"
          onPress={() => router.push(`/one-off?date=${todayStr}`)}
          style={{ flex: 1 }}
        />
      </View>

      <Button
        label="Backfill past attendance"
        tone="ghost"
        onPress={() => router.push('/backfill')}
        style={{ marginTop: space.md }}
      />
    </ScrollView>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryRow}>
      <Txt variant="small" color={colors.textFaint}>
        {label}
      </Txt>
      <Txt variant="h3" color={color}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.xl },
  streak: {
    alignItems: 'center',
    backgroundColor: colors.warnSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroDot: { width: 7, height: 7, borderRadius: 4 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm, flexWrap: 'wrap' },
  heroActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.sm },
  remindBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  summary: { marginTop: space.lg },
  summaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    padding: space.lg,
  },
  summaryStats: { flex: 1, gap: space.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerActions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
});
