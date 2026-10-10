import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayPicker, Field, TimeField } from '../src/components/forms';
import { Button, Card, SectionHeader, Squish, Txt } from '../src/components/ui';
import { useNow } from '../src/hooks';
import { roomsAt } from '../src/lib/rooms';
import { DAY_NAMES, formatTime, fromMinutes } from '../src/lib/schedule';
import { useStore } from '../src/store';
import { radius, space, type Theme } from '../src/theme';
import { useColors, useThemedStyles } from '../src/theme-context';
import type { DayIndex } from '../src/types';

/**
 * "Which rooms are free right now?"
 *
 * Answered from the bundled catalog crossed with the live slot grid, so it
 * covers the whole institute rather than only the courses you happen to take.
 */
export default function RoomsScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // A minute is fine here; the grid only changes on period boundaries.
  const now = useNow(60000);
  const slots = useStore((s) => s.slots);
  const courses = useStore((s) => s.courses);

  // `null` means "track the clock". Picking a day or time pins the view to a
  // fixed moment, which is what makes the future lookup possible.
  const [pinned, setPinned] = React.useState<{ day: DayIndex; time: string } | null>(null);

  const day = pinned ? pinned.day : (now.getDay() as DayIndex);
  const time = pinned ? pinned.time : fromMinutes(now.getHours() * 60 + now.getMinutes());

  // A synthetic date carrying the inspected weekday and clock time. Only those
  // two fields are read downstream, so the calendar date is irrelevant.
  const when = React.useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + ((day - now.getDay() + 7) % 7));
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }, [day, time, now.getDay(), Math.floor(now.getTime() / 60000)]);

  const snap = React.useMemo(() => roomsAt(when, slots, courses), [when, slots, courses]);

  const pin = (next: Partial<{ day: DayIndex; time: string }>) =>
    setPinned({ day, time, ...next });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <Squish onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
          <Txt variant="h3" color={colors.textDim}>
            ‹
          </Txt>
        </Squish>
        <View style={{ flex: 1 }}>
          <Txt variant="h2">Classrooms</Txt>
          <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
            {snap.occupied.length} BUSY · {snap.free.length} FREE
          </Txt>
        </View>
        {pinned ? (
          <Squish onPress={() => setPinned(null)} style={styles.nowBtn} scaleTo={0.92}>
            <Txt variant="tiny" color={colors.accent}>
              NOW
            </Txt>
          </Squish>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------------------------------- when -- */}
        <Card padded>
          <Txt variant="tiny" color={colors.textFaint}>
            {pinned ? 'SHOWING' : 'RIGHT NOW'}
          </Txt>
          <Txt variant="h3" style={{ marginTop: 4 }}>
            {DAY_NAMES[day]} · {formatTime(time)}
          </Txt>

          <View style={{ marginTop: space.lg }}>
            <DayPicker value={day} onChange={(d) => pin({ day: d })} />
          </View>

          <View style={{ marginTop: space.md }}>
            <Field label="Time" hint="Check a later period to plan ahead.">
              <TimeField value={time} onChange={(t) => pin({ time: t })} />
            </Field>
          </View>

          <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 4, letterSpacing: 0 }}>
            {snap.activeSlots.length > 0
              ? `Slot ${snap.activeSlots.join(', ')} in session.`
              : 'No teaching period at this time.'}
          </Txt>
        </Card>

        {/* --------------------------------------------------- occupied -- */}
        {snap.occupied.length > 0 ? (
          <>
            <SectionHeader title={`Occupied · ${snap.occupied.length}`} />
            {snap.occupied.map((room, i) => (
              <Animated.View key={room.key} entering={FadeInDown.duration(220).delay(i * 18)}>
                <Card padded style={{ marginBottom: space.md }}>
                  <View style={styles.roomHead}>
                    <View style={[styles.dot, { backgroundColor: colors.absent }]} />
                    <Txt variant="h3">{room.label}</Txt>
                    {room.campus ? (
                      <Txt variant="tiny" color={colors.textFaint}>
                        {room.campus.toUpperCase()}
                      </Txt>
                    ) : null}
                  </View>

                  {room.occupants.map((o) => (
                    <View key={o.code} style={styles.occupant}>
                      <View style={styles.slotChip}>
                        <Txt variant="tiny" color={colors.textDim}>
                          {o.meetingLabel || o.slotKey || '—'}
                        </Txt>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt variant="small" numberOfLines={1}>
                          {o.code}
                          {o.mine ? '  ·  yours' : ''}
                        </Txt>
                        <Txt variant="tiny" color={colors.textFaint} numberOfLines={1} style={{ marginTop: 1 }}>
                          {[o.name, o.faculty].filter(Boolean).join(' · ')}
                        </Txt>
                      </View>
                    </View>
                  ))}
                </Card>
              </Animated.View>
            ))}
          </>
        ) : null}

        {/* ------------------------------------------------------- free -- */}
        <SectionHeader title={`Free · ${snap.free.length}`} />
        {snap.free.length === 0 ? (
          <Card padded>
            <Txt variant="small" color={colors.textDim}>
              Every known room is in use at this time.
            </Txt>
          </Card>
        ) : (
          <View style={styles.chips}>
            {snap.free.map((room) => (
              <View key={room.key} style={styles.freeChip}>
                <Txt variant="small" color={colors.present}>
                  {room.label}
                </Txt>
              </View>
            ))}
          </View>
        )}

        <Txt variant="tiny" color={colors.textFaint} center style={{ marginTop: space.xl, letterSpacing: 0, lineHeight: 17 }}>
          Based on the institute course chart. Rooms booked outside it — labs,
          seminars, one-off bookings — will not show here.
        </Txt>

        {pinned ? (
          <Button
            label="Back to now"
            tone="ghost"
            onPress={() => setPinned(null)}
            style={{ marginTop: space.lg }}
          />
        ) : null}
      </ScrollView>
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
    nowBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.accentSoft,
    },
    roomHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    dot: { width: 7, height: 7, borderRadius: radius.pill },
    occupant: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginTop: space.md,
    },
    slotChip: {
      minWidth: 34,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceHi,
      alignItems: 'center',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    freeChip: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: radius.sm,
      backgroundColor: colors.presentSoft,
    },
  });
