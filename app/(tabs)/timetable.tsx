import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClassCard } from '../../src/components/ClassCard';
import { Button, Card, EmptyState, SegmentedControl, Squish, Txt } from '../../src/components/ui';
import { useNow } from '../../src/hooks';
import { exportTimetablePdf } from '../../src/lib/export';
import {
  DAY_NAMES,
  DAY_SHORT,
  addDays,
  classesOn,
  courseMeetings,
  dateKey,
  formatTime,
  toMinutes,
} from '../../src/lib/schedule';
import { selectScheduleInput, useStore } from '../../src/store';
import { colors, paletteAt, radius, space } from '../../src/theme';
import type { Course } from '../../src/types';

type TimetableView = 'grid' | 'day';

const COL_WIDTH = 132;
const TIME_COL = 62;

export default function TimetableScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow(30000);
  const input = useStore(selectScheduleInput);
  const { courses, slots, marks, settings } = input;

  const [view, setView] = React.useState<TimetableView>('grid');
  const [dayOffset, setDayOffset] = React.useState(0);
  const [exporting, setExporting] = React.useState(false);

  const active = courses.filter((c) => !c.archived);

  /** Distinct periods and days derived from the user's actual enrolled courses. */
  const { periods, days, grid } = React.useMemo(() => {
    const periodMap = new Map<string, { start: string; end: string }>();
    const daySet = new Set<number>();
    const cells = new Map<string, { course: Course; label?: string; room: string }[]>();

    for (const course of active) {
      for (const mt of courseMeetings(course, slots)) {
        const pk = `${mt.start}-${mt.end}`;
        periodMap.set(pk, { start: mt.start, end: mt.end });
        daySet.add(mt.day);
        const key = `${mt.day}|${pk}`;
        cells.set(key, [
          ...(cells.get(key) ?? []),
          { course, label: mt.label, room: mt.room || course.room },
        ]);
      }
    }

    return {
      periods: [...periodMap.values()].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
      // Order Mon→Sun so the academic week reads naturally.
      days: [...daySet].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)),
      grid: cells,
    };
  }, [active, slots]);

  const viewedDate = React.useMemo(() => addDays(now, dayOffset), [now.toDateString(), dayOffset]);
  const dayClasses = React.useMemo(
    () => classesOn(viewedDate, input),
    [input, viewedDate.toDateString()],
  );

  const onExport = async () => {
    setExporting(true);
    const res = await exportTimetablePdf(courses, slots, marks, settings);
    setExporting(false);
    if (!res.ok) Alert.alert('Export', res.message);
  };

  if (active.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top }}>
        <EmptyState
          icon="🗓"
          title="Timetable is empty"
          body="Once you add courses, your weekly grid builds itself from their slots."
          actionLabel="Add a course"
          onAction={() => router.push('/add-course')}
        />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="h1">Timetable</Txt>
          <Txt variant="small" color={colors.textFaint} style={{ marginTop: 2 }}>
            {active.length} course{active.length === 1 ? '' : 's'} · {periods.length} period
            {periods.length === 1 ? '' : 's'}
          </Txt>
        </View>
        <Squish
          onPress={onExport}
          haptic="medium"
          style={styles.exportBtn}
          disabled={exporting}
        >
          <Txt variant="small" color={colors.accent}>
            {exporting ? 'Preparing…' : '↓ Export'}
          </Txt>
        </Squish>
      </View>

      <View style={{ paddingHorizontal: space.lg, marginBottom: space.lg }}>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: 'grid', label: 'Week grid' },
            { value: 'day', label: 'By day' },
          ]}
        />
      </View>

      {view === 'grid' ? (
        <GridView periods={periods} days={days} grid={grid} today={now.getDay()} />
      ) : (
        <DayView
          date={viewedDate}
          offset={dayOffset}
          onOffset={setDayOffset}
          classes={dayClasses}
          now={now}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------- grid view -- */

function GridView({
  periods,
  days,
  grid,
  today,
}: {
  periods: { start: string; end: string }[];
  days: number[];
  grid: Map<string, { course: Course; label?: string; room: string }[]>;
  today: number;
}) {
  if (periods.length === 0) {
    return (
      <EmptyState
        icon="⏰"
        title="No timings set"
        body="Your courses have no meetings yet. Open Settings › Time slots to define when each slot meets."
      />
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
    >
      <View>
        {/* Day header */}
        <View style={styles.gridHeaderRow}>
          <View style={{ width: TIME_COL }} />
          {days.map((d) => (
            <View
              key={d}
              style={[styles.gridHeaderCell, d === today && styles.gridHeaderCellToday]}
            >
              <Txt variant="tiny" color={d === today ? colors.accent : colors.textDim}>
                {DAY_SHORT[d].toUpperCase()}
              </Txt>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
          {periods.map((p, idx) => (
            <Animated.View
              key={`${p.start}-${p.end}`}
              entering={FadeInDown.duration(260).delay(idx * 35)}
              style={styles.gridRow}
            >
              <View style={styles.timeCell}>
                <Txt variant="small" color={colors.textDim}>
                  {formatTime(p.start).replace(' AM', '').replace(' PM', '')}
                </Txt>
                <Txt variant="tiny" color={colors.textFaint}>
                  {toMinutes(p.start) >= 720 ? 'PM' : 'AM'}
                </Txt>
              </View>

              {days.map((d) => {
                const items = grid.get(`${d}|${p.start}-${p.end}`) ?? [];
                return (
                  <View key={d} style={styles.gridCell}>
                    {items.length === 0 ? (
                      <View style={styles.emptyCell} />
                    ) : (
                      items.map((it) => {
                        const c = paletteAt(it.course.colorIndex);
                        return (
                          <View
                            key={`${it.course.id}-${it.label ?? ''}`}
                            style={[
                              styles.classChip,
                              { backgroundColor: c.tint, borderLeftColor: c.base },
                            ]}
                          >
                            <Txt variant="tiny" color={c.base} numberOfLines={1}>
                              {it.course.code.replace(/_(NEW|New|new)$/, '')}
                            </Txt>
                            <Txt
                              variant="small"
                              color={colors.text}
                              numberOfLines={2}
                              style={{ marginTop: 2, fontSize: 11, lineHeight: 14 }}
                            >
                              {it.course.name}
                            </Txt>
                            {it.room ? (
                              <Txt variant="tiny" color={colors.textFaint} numberOfLines={1} style={{ marginTop: 2 }}>
                                {it.room}
                              </Txt>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                );
              })}
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------------------------- day view -- */

function DayView({
  date,
  offset,
  onOffset,
  classes,
  now,
}: {
  date: Date;
  offset: number;
  onOffset: (n: number) => void;
  classes: ReturnType<typeof classesOn>;
  now: Date;
}) {
  const router = useRouter();
  const isToday = date.toDateString() === now.toDateString();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <Card padded={false} style={{ marginBottom: space.lg }}>
        <View style={styles.dayNav}>
          <Squish onPress={() => onOffset(offset - 1)} style={styles.navBtn} scaleTo={0.9}>
            <Txt variant="h3" color={colors.textDim}>
              ‹
            </Txt>
          </Squish>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="h3">{DAY_NAMES[date.getDay()]}</Txt>
            <Txt variant="tiny" color={isToday ? colors.accent : colors.textFaint} style={{ marginTop: 2 }}>
              {isToday
                ? 'TODAY'
                : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}
            </Txt>
          </View>

          <Squish onPress={() => onOffset(offset + 1)} style={styles.navBtn} scaleTo={0.9}>
            <Txt variant="h3" color={colors.textDim}>
              ›
            </Txt>
          </Squish>
        </View>
      </Card>

      {offset !== 0 ? (
        <Button label="Jump to today" tone="ghost" onPress={() => onOffset(0)} style={{ marginBottom: space.lg }} />
      ) : null}

      {classes.length === 0 ? (
        <Animated.View entering={FadeIn}>
          <Card padded style={{ alignItems: 'center', paddingVertical: space.xxl }}>
            <Txt variant="h2">No classes</Txt>
            <Txt variant="small" color={colors.textDim} style={{ marginTop: space.sm }}>
              Nothing scheduled for this day.
            </Txt>
          </Card>
        </Animated.View>
      ) : (
        classes.map((c) => <ClassCard key={c.key} instance={c} />)
      )}

      <Squish
        scaleTo={0.97}
        onPress={() => router.push(`/one-off?date=${dateKey(date)}`)}
        style={styles.addExtra}
      >
        <Txt variant="small" color={colors.textDim}>
          + Extra class on this day
        </Txt>
      </Squish>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
    gap: space.md,
  },
  exportBtn: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  gridHeaderRow: { flexDirection: 'row', marginBottom: space.sm },
  gridHeaderCell: {
    width: COL_WIDTH,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
    marginHorizontal: 2,
  },
  gridHeaderCellToday: { backgroundColor: colors.accentSoft },
  gridRow: { flexDirection: 'row', marginBottom: 6 },
  timeCell: { width: TIME_COL, paddingTop: 10, paddingRight: space.sm, alignItems: 'flex-end' },
  gridCell: { width: COL_WIDTH, marginHorizontal: 2 },
  emptyCell: {
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  classChip: {
    minHeight: 58,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    padding: 8,
    marginBottom: 4,
    justifyContent: 'center',
  },
  dayNav: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExtra: {
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: space.sm,
  },
});
