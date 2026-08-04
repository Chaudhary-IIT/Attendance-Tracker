import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bar, EmptyState, SegmentedControl, Squish, Txt } from '../../src/components/ui';
import { courseMeetings, statsFor } from '../../src/lib/schedule';
import { useStore } from '../../src/store';
import { colors, healthColor, paletteAt, radius, space } from '../../src/theme';
import type { Course } from '../../src/types';

type Filter = 'active' | 'risk' | 'archived';

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const courses = useStore((s) => s.courses);
  const slots = useStore((s) => s.slots);
  const marks = useStore((s) => s.marks);
  const settings = useStore((s) => s.settings);

  const [filter, setFilter] = React.useState<Filter>('active');

  const rows = React.useMemo(() => {
    return courses
      .map((course) => ({ course, stats: statsFor(course, marks, settings) }))
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
      });
  }, [courses, marks, settings, filter]);

  const activeCount = courses.filter((c) => !c.archived).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="h1">Courses</Txt>
          <Txt variant="small" color={colors.textFaint} style={{ marginTop: 2 }}>
            {activeCount} enrolled · {settings.minAttendance}% target
          </Txt>
        </View>
        <Squish onPress={() => router.push('/add-course')} haptic="medium" style={styles.addBtn}>
          <Txt variant="h2" color={colors.bg}>
            +
          </Txt>
        </Squish>
      </View>

      <View style={{ paddingHorizontal: space.lg, marginBottom: space.lg }}>
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
  const c = paletteAt(course.colorIndex);
  const health = healthColor(stats.percent, stats.threshold);

  // The single most useful sentence about this course, right now.
  const verdict =
    stats.held === 0
      ? `${meetingCount}× a week · nothing marked yet`
      : stats.percent != null && stats.percent >= stats.threshold
        ? stats.canSkip > 0
          ? `Can skip ${stats.canSkip} more`
          : 'Exactly at the line — do not skip'
        : `Attend ${stats.mustAttend} in a row to recover`;

  return (
    <Animated.View entering={FadeInDown.duration(280).delay(index * 45)} layout={Layout.springify()}>
      <Squish scaleTo={0.98} onPress={onPress} style={[styles.row, { borderColor: `${c.base}26` }]}>
        <View style={[styles.rowRail, { backgroundColor: c.base }]} />

        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.rowCodeLine}>
              <Txt variant="tiny" color={c.base}>
                {course.code}
              </Txt>
              {course.slotKey ? (
                <View style={[styles.slotTag, { backgroundColor: `${c.base}1F` }]}>
                  <Txt variant="tiny" color={c.base}>
                    {course.slotKey}
                  </Txt>
                </View>
              ) : (
                <View style={[styles.slotTag, { backgroundColor: colors.surfaceHi }]}>
                  <Txt variant="tiny" color={colors.textFaint}>
                    NO SLOT
                  </Txt>
                </View>
              )}
              {course.archived ? (
                <Txt variant="tiny" color={colors.textFaint}>
                  ARCHIVED
                </Txt>
              ) : null}
            </View>

            <Txt variant="h3" numberOfLines={2} style={{ marginTop: 4 }}>
              {course.name}
            </Txt>

            {course.room || course.faculty ? (
              <Txt variant="small" color={colors.textDim} numberOfLines={1} style={{ marginTop: 3 }}>
                {[course.room, course.faculty].filter(Boolean).join(' · ')}
              </Txt>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="h1" color={health} style={{ fontSize: 26 }}>
              {stats.percent == null ? '—' : `${Math.round(stats.percent)}`}
            </Txt>
            <Txt variant="tiny" color={colors.textFaint}>
              {stats.percent == null ? 'NO DATA' : 'PERCENT'}
            </Txt>
          </View>
        </View>

        <View style={{ marginTop: space.md }}>
          <Bar percent={stats.percent} color={health} />
        </View>

        <View style={styles.rowBottom}>
          <Txt variant="small" color={colors.textDim}>
            {stats.present}/{stats.held} attended
            {stats.cancelled > 0 ? ` · ${stats.cancelled} cancelled` : ''}
          </Txt>
          <Txt variant="small" color={health}>
            {verdict}
          </Txt>
        </View>
      </Squish>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    paddingLeft: space.lg + 4,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  rowRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  rowTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  rowCodeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  slotTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.sm,
    gap: space.sm,
  },
});
