import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Squish, Txt } from '../src/components/ui';
import { DAY_SHORT, formatTime, toMinutes } from '../src/lib/schedule';
import { useStore } from '../src/store';
import { radius, space, type Theme } from '../src/theme';
import { useColors, useTheme, useThemedStyles } from '../src/theme-context';

export default function SlotsScreen() {
  const colors = useColors();
  const { paletteAt } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const slots = useStore((s) => s.slots);
  const courses = useStore((s) => s.courses);
  const addSlot = useStore((s) => s.addSlot);

  const createSlot = () => {
    // Next free single-letter key, falling back to a numbered one.
    const used = new Set(slots.map((s) => s.key));
    let key = 'X';
    for (const ch of 'IJKMNOPQRSTUVWXYZ') {
      if (!used.has(ch)) {
        key = ch;
        break;
      }
    }
    if (used.has(key)) key = `S${slots.length + 1}`;

    const id = addSlot({
      key,
      name: `Slot ${key}`,
      kind: 'custom',
      colorIndex: slots.length,
      meetings: [],
    });
    router.push(`/slot/${id}`);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <Squish onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
          <Txt variant="h3" color={colors.textDim}>
            ‹
          </Txt>
        </Squish>
        <View style={{ flex: 1 }}>
          <Txt variant="h2">Time slots</Txt>
          <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
            {slots.length} DEFINED
          </Txt>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Txt variant="small" color={colors.textDim} style={{ marginBottom: space.lg, lineHeight: 20 }}>
          A slot is a named set of weekly timings. Courses attach to a slot and inherit its
          schedule, so fixing a time here fixes it everywhere at once.
        </Txt>

        {slots.map((slot, i) => {
          const entry = paletteAt(slot.colorIndex);
          const usedBy = courses.filter((co) => co.slotKey === slot.key && !co.archived).length;
          const sorted = [...slot.meetings].sort(
            (a, b) =>
              ((a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)) ||
              toMinutes(a.start) - toMinutes(b.start),
          );

          return (
            <Animated.View
              key={slot.id}
              entering={FadeInDown.duration(240).delay(i * 30)}
              layout={Layout.springify()}
            >
              <Squish
                scaleTo={0.98}
                onPress={() => router.push(`/slot/${slot.id}`)}
                style={[styles.slotCard, { borderColor: `${entry.base}26` }]}
              >
                <View style={[styles.rail, { backgroundColor: entry.base }]} />

                <View style={styles.slotHead}>
                  <View style={[styles.keyBadge, { backgroundColor: entry.base }]}>
                    <Txt variant="small" color={colors.onAccent}>
                      {slot.key}
                    </Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{slot.name}</Txt>
                    <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
                      {slot.meetings.length} MEETING{slot.meetings.length === 1 ? '' : 'S'} ·{' '}
                      {usedBy} COURSE{usedBy === 1 ? '' : 'S'}
                    </Txt>
                  </View>
                  <Txt variant="body" color={colors.textFaint}>
                    ›
                  </Txt>
                </View>

                {sorted.length > 0 ? (
                  <View style={styles.meetingList}>
                    {sorted.map((mt) => (
                      <View key={mt.id} style={[styles.meetChip, { backgroundColor: entry.tint }]}>
                        <Txt variant="tiny" color={entry.base}>
                          {DAY_SHORT[mt.day].toUpperCase()} {formatTime(mt.start)}
                        </Txt>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Txt variant="small" color={colors.textFaint} style={{ marginTop: space.sm }}>
                    No timings set yet — tap to add them.
                  </Txt>
                )}
              </Squish>
            </Animated.View>
          );
        })}

        <Button label="+ New slot" tone="ghost" onPress={createSlot} style={{ marginTop: space.lg }} />
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
  slotCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    paddingLeft: space.lg + 4,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  slotHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  keyBadge: {
    minWidth: 38,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  meetChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm },
});
