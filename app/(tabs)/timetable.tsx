import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
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
import { useScheduleInput } from '../../src/store';
import { radius, space, type Theme } from '../../src/theme';
import { useColors, useTheme, useThemedStyles } from '../../src/theme-context';
import type { Course } from '../../src/types';

type TimetableView = 'grid' | 'day';

/**
 * Grid geometry. Every one of these is used by both the pinned time column and
 * the scrolling day columns, so the two stay in lockstep — hard-coding a height
 * in only one of them is what makes a timetable look crooked.
 */
const COL_WIDTH = 132;
const COL_GAP = 4;
const TIME_COL = 62;
const HEAD_H = 30;
const ROW_H = 74;
const ROW_GAP = 6;

export default function TimetableScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const now = useNow(30000);
  const input = useScheduleInput();
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

/**
 * Which column to reveal on open. Prefers today; if today has no classes it
 * lands on the next teaching day of the week rather than snapping back to
 * Monday, which is what you actually want to see on a free Sunday.
 */
function todayColumn(days: number[], today: number): number {
  const exact = days.indexOf(today);
  if (exact >= 0) return exact;
  const order = (d: number) => (d === 0 ? 7 : d);
  const next = days.findIndex((d) => order(d) > order(today));
  return next >= 0 ? next : 0;
}

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
  const colors = useColors();
  const { paletteAt } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Two horizontal scrollers kept in sync: the day header is pinned above the
  // vertical scroll, so it has to be dragged along by the body rather than
  // scrolled by the user.
  const headRef = React.useRef<ScrollView>(null);
  const bodyRef = React.useRef<ScrollView>(null);

  const dayKey = days.join(',');
  React.useEffect(() => {
    const idx = todayColumn(days, today);
    if (idx <= 0) return;
    // Leave a sliver of the previous column visible so it still reads as a
    // scrollable week rather than as if the earlier days do not exist.
    const x = Math.max(0, idx * (COL_WIDTH + COL_GAP) - 26);
    // The scroll view has to have laid out before it can be told where to go.
    const timer = setTimeout(() => bodyRef.current?.scrollTo({ x, animated: true }), 260);
    return () => clearTimeout(timer);
  }, [dayKey, today]);

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
    <View style={{ flex: 1 }}>
      {/* Pinned day header. */}
      <View style={styles.gridHeaderRow}>
        <View style={{ width: TIME_COL }} />
        <ScrollView
          ref={headRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: space.lg }}
        >
          {days.map((d) => (
            <View key={d} style={[styles.gridHeaderCell, d === today && styles.gridHeaderCellToday]}>
              <Txt variant="tiny" color={d === today ? colors.accent : colors.textDim}>
                {DAY_SHORT[d].toUpperCase()}
              </Txt>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <Animated.View entering={FadeIn.duration(240)} style={styles.gridBody}>
          {/* Pinned time column — stays put while the week scrolls sideways. */}
          <View style={{ width: TIME_COL }}>
            {periods.map((p) => (
              <View key={`${p.start}-${p.end}`} style={styles.timeCell}>
                <Txt variant="small" color={colors.textDim}>
                  {formatTime(p.start).replace(/ [AP]M$/, '')}
                </Txt>
                <Txt variant="tiny" color={colors.textFaint} style={{ letterSpacing: 0 }}>
                  {formatTime(p.end)}
                </Txt>
              </View>
            ))}
          </View>

          <ScrollView
            ref={bodyRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) =>
              headRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })
            }
            contentContainerStyle={{ paddingRight: space.lg }}
          >
            <View>
              {periods.map((p) => (
                <View key={`${p.start}-${p.end}`} style={styles.gridRow}>
                  {days.map((d) => {
                    const items = grid.get(`${d}|${p.start}-${p.end}`) ?? [];
                    // Two classes share one cell's height, so the chips have to
                    // drop to code-only or the text is clipped mid-word.
                    const dense = items.length > 1;

                    return (
                      <View key={d} style={[styles.gridCell, d === today && styles.gridCellToday]}>
                        {items.length === 0 ? (
                          <View style={styles.emptyCell} />
                        ) : (
                          items.map((it) => {
                            const entry = paletteAt(it.course.colorIndex);
                            return (
                              <View
                                key={`${it.course.id}-${it.label ?? ''}`}
                                style={[
                                  styles.classChip,
                                  { backgroundColor: entry.tint, borderLeftColor: entry.base },
                                ]}
                              >
                                <Txt variant="tiny" color={entry.base} numberOfLines={1}>
                                  {it.course.code.replace(/_(NEW|New|new)$/, '')}
                                </Txt>
                                {dense ? null : (
                                  <>
                                    <Txt
                                      color={colors.text}
                                      numberOfLines={2}
                                      style={styles.chipName}
                                    >
                                      {it.course.name}
                                    </Txt>
                                    {it.room ? (
                                      <Txt
                                        color={colors.textFaint}
                                        numberOfLines={1}
                                        style={styles.chipRoom}
                                      >
                                        {it.room}
                                      </Txt>
                                    ) : null}
                                  </>
                                )}
                              </View>
                            );
                          })
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </ScrollView>
    </View>
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
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
    exportBtn: {
      backgroundColor: colors.accentSoft,
      paddingHorizontal: space.lg,
      paddingVertical: 9,
      borderRadius: radius.pill,
    },
    gridHeaderRow: {
      flexDirection: 'row',
      marginBottom: space.sm,
      paddingLeft: space.lg,
    },
    gridHeaderCell: {
      width: COL_WIDTH,
      height: HEAD_H,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      marginHorizontal: COL_GAP / 2,
    },
    gridHeaderCellToday: { backgroundColor: colors.accentSoft },

    gridBody: { flexDirection: 'row', paddingLeft: space.lg },
    // Fixed height on the row is what makes every cell in it identical; the time
    // column mirrors it exactly so the two never drift apart.
    gridRow: { flexDirection: 'row', height: ROW_H, marginBottom: ROW_GAP },
    timeCell: {
      width: TIME_COL,
      height: ROW_H,
      marginBottom: ROW_GAP,
      paddingRight: space.sm,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    gridCell: {
      width: COL_WIDTH,
      height: ROW_H,
      marginHorizontal: COL_GAP / 2,
      borderRadius: radius.sm,
      gap: 3,
    },
    gridCellToday: { backgroundColor: colors.todayTint },
    // `flex: 1` on both states is the whole trick: one chip fills the row, two
    // split it evenly, and an empty cell matches either — no fixed heights that
    // disagree with each other.
    emptyCell: {
      flex: 1,
      borderRadius: radius.sm,
      backgroundColor: colors.cellEmpty,
      borderWidth: 1,
      borderColor: colors.cellEmptyBorder,
    },
    classChip: {
      flex: 1,
      borderRadius: radius.sm,
      borderLeftWidth: 3,
      paddingHorizontal: 8,
      paddingVertical: 6,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    chipName: { fontSize: 11, fontWeight: '600', lineHeight: 13, marginTop: 2 },
    chipRoom: { fontSize: 10, fontWeight: '700', lineHeight: 12, marginTop: 2 },
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
