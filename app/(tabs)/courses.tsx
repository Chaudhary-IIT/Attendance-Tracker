import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bar, EmptyState, SegmentedControl, Squish, Txt } from '../../src/components/ui';
import { courseMeetings, statsFor } from '../../src/lib/schedule';
import { useStore } from '../../src/store';
import { healthColor, radius, space, type Theme } from '../../src/theme';
import { useColors, useTheme, useThemedStyles } from '../../src/theme-context';
import type { Course } from '../../src/types';

type Filter = 'active' | 'risk' | 'archived';

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const courses = useStore((s) => s.courses);
  const slots = useStore((s) => s.slots);
  const marks = useStore((s) => s.marks);
  const settings = useStore((s) => s.settings);

  const [filter, setFilter] = React.useState<Filter>('active');

  const { rows, activeCount, riskCount } = React.useMemo(() => {
    const all = courses.map((course) => ({ course, stats: statsFor(course, marks, settings) }));
    return {
      rows: all
        .filter(({ course, stats }) => {
          if (filter === 'archived') return course.archived;
          if (course.archived) return false;
          if (filter === 'risk') return stats.percent != null && stats.percent < stats.threshold;
          return true;
        })
        .sort((a, b) => {
          // Most at-risk first; unmarked courses sink to the bottom.
          const pa = a.stats.percent ?? 999;
          const pb = b.stats.percent ?? 999;
          return pa - pb || a.course.code.localeCompare(b.course.code);
        }),
      activeCount: all.filter((r) => !r.course.archived).length,
      riskCount: all.filter(
        (r) => !r.course.archived && r.stats.percent != null && r.stats.percent < r.stats.threshold,
      ).length,
    };
  }, [courses, marks, settings, filter]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="h1">Courses</Txt>
          <Txt variant="small" color={colors.textFaint} style={{ marginTop: 3 }}>
            {activeCount} enrolled · {settings.minAttendance}% target
            {riskCount > 0 ? ` · ${riskCount} below` : ''}
          </Txt>
        </View>
        <Squish onPress={() => router.push('/add-course')} haptic="medium" style={styles.addBtn}>
          <Txt color={colors.onAccent} style={styles.addGlyph}>
            +
          </Txt>
        </Squish>
      </View>

      <View style={styles.filterWrap}>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'All' },
            { value: 'risk', label: 'At risk' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={filter === 'risk' ? '✨' : filter === 'archived' ? '📦' : '📚'}
            title={
              filter === 'risk'
                ? 'Everything is safe'
                : filter === 'archived'
                  ? 'Nothing archived'
                  : 'No courses yet'
            }
            body={
              filter === 'risk'
                ? `Every course is at or above your ${settings.minAttendance}% target. Keep it up.`
                : filter === 'archived'
                  ? 'Courses you archive are kept here with their history intact.'
                  : 'Pick from the institute catalog or create your own — slot, room and timings fill in automatically.'
            }
            actionLabel={filter === 'active' ? 'Add a course' : undefined}
            onAction={() => router.push('/add-course')}
          />
        ) : (
          rows.map(({ course, stats }, i) => (
            <CourseRow
              key={course.id}
              course={course}
              stats={stats}
              meetingCount={courseMeetings(course, slots).length}
              index={i}
              onPress={() => router.push(`/course/${course.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

/**
 * One course, read top-down: what it is, how you're doing, what to do next.
 *
 * The name leads because that is what you scan for; the code and slot are
 * demoted to a single metadata line. Every text block is capped to one or two
 * lines with a fixed-width percentage badge on the right, so rows share the
 * same silhouette however long the course titles are.
 */
function CourseRow({
  course,
  stats,
  meetingCount,
  index,
  onPress,
}: {
  course: Course;
  stats: ReturnType<typeof statsFor>;
  meetingCount: number;
  index: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const { paletteAt } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const entry = paletteAt(course.colorIndex);
  const health = healthColor(stats.percent, stats.threshold, colors);

  // The single most useful sentence about this course, right now.
  const verdict =
    stats.held === 0
      ? 'Nothing marked yet'
      : stats.percent != null && stats.percent >= stats.threshold
        ? stats.canSkip > 0
          ? `${stats.canSkip} skip${stats.canSkip === 1 ? '' : 's'} in hand`
          : 'At the line — do not skip'
        : `Attend ${stats.mustAttend} to recover`;

  // Room and faculty get their own line. Folded into the code/slot line they
  // were the first thing `numberOfLines={1}` threw away, so the instructor
  // simply never appeared.
  const people = [course.room, course.faculty].filter(Boolean).join('  ·  ');

  return (
    <Animated.View entering={FadeInDown.duration(280).delay(index * 45)} layout={Layout.springify()}>
      <Squish scaleTo={0.985} onPress={onPress} style={styles.row}>
        <View
          style={[styles.rowRail, { backgroundColor: course.archived ? colors.textFaint : entry.base }]}
        />

        <Txt variant="title" numberOfLines={2}>
          {course.name}
        </Txt>

        <View style={styles.metaLine}>
          <Txt variant="label" color={entry.base} numberOfLines={1}>
            {course.code}
          </Txt>
          <Txt variant="label" color={colors.textFaint}>
            ·
          </Txt>
          <Txt variant="label" color={colors.textFaint} numberOfLines={1}>
            {course.slotKey ?? 'No slot'}
          </Txt>
          <Txt variant="label" color={colors.textFaint}>
            ·
          </Txt>
          <Txt variant="label" color={colors.textFaint} numberOfLines={1}>
            {meetingCount}×/week
          </Txt>
          {course.archived ? (
            <View style={styles.archiveTag}>
              <Txt variant="tiny" color={colors.textFaint}>
                ARCHIVED
              </Txt>
            </View>
          ) : null}
        </View>

        {people ? (
          <Txt variant="small" color={colors.textDim} numberOfLines={1} style={{ marginTop: 5 }}>
            {people}
          </Txt>
        ) : null}

        {/* The number belongs to the bar, so it sits on the bar's line at the
            bar's weight rather than shouting from a badge of its own. */}
        <View style={styles.barRow}>
          <View style={{ flex: 1 }}>
            <Bar percent={stats.percent} color={health} marker={stats.threshold} />
          </View>
          <View style={styles.pct}>
            {stats.percent == null ? (
              <Txt color={colors.textFaint} style={styles.pctNum}>
                —
              </Txt>
            ) : (
              <>
                <Txt color={health} style={styles.pctNum}>
                  {Math.round(stats.percent)}
                </Txt>
                <Txt color={health} style={styles.pctSign}>
                  %
                </Txt>
              </>
            )}
          </View>
        </View>

        <View style={styles.rowBottom}>
          <Txt variant="small" color={colors.textDim} numberOfLines={1}>
            {stats.held === 0 ? 'No classes recorded' : `${stats.present} of ${stats.held} attended`}
            {stats.cancelled > 0 ? ` · ${stats.cancelled} off` : ''}
          </Txt>
          <Txt
            variant="small"
            color={stats.held === 0 ? colors.textFaint : health}
            numberOfLines={1}
            style={{ flexShrink: 1, marginLeft: space.md }}
          >
            {verdict}
          </Txt>
        </View>
      </Squish>
    </Animated.View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.lg,
      marginBottom: space.lg,
      gap: space.md,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // A "+" glyph sits optically high in most fonts; nudge it back onto centre.
    addGlyph: { fontSize: 26, fontWeight: '400', lineHeight: 30, marginTop: -2 },
    filterWrap: { paddingHorizontal: space.lg, marginBottom: space.lg },

    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      paddingLeft: space.lg + 5,
      marginBottom: space.md,
      overflow: 'hidden',
    },
    rowRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
    archiveTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: colors.surfaceHi,
      marginLeft: 2,
    },

    barRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg },
    // Fixed width so every bar in the list ends at the same x, however many
    // digits the percentage has.
    pct: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      width: 46,
      marginLeft: space.md,
    },
    pctNum: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
    pctSign: { fontSize: 10, fontWeight: '700', marginLeft: 1 },

    rowBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: space.md,
    },
  });
