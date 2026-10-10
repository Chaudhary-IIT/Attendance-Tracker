import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ColorPicker,
  DayPicker,
  Field,
  TextField,
  TimeField,
} from '../../src/components/forms';
import { Button, Card, SectionHeader, Squish, Txt } from '../../src/components/ui';
import { toMinutes } from '../../src/lib/schedule';
import { useStore } from '../../src/store';
import { space, type Theme } from '../../src/theme';
import { useColors, useTheme, useThemedStyles } from '../../src/theme-context';
import type { DayIndex } from '../../src/types';

export default function SlotEditorScreen() {
  const colors = useColors();
  const { paletteAt } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const slot = useStore((s) => s.slots.find((x) => x.id === id));
  const courses = useStore((s) => s.courses);
  const updateSlot = useStore((s) => s.updateSlot);
  const deleteSlot = useStore((s) => s.deleteSlot);
  const addMeeting = useStore((s) => s.addMeeting);
  const updateMeeting = useStore((s) => s.updateMeeting);
  const deleteMeeting = useStore((s) => s.deleteMeeting);

  if (!slot) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.xxl, alignItems: 'center' }]}>
        <Txt variant="h2">Slot not found</Txt>
        <Button label="Go back" tone="ghost" onPress={() => router.back()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  const entry = paletteAt(slot.colorIndex);
  const usedBy = courses.filter((co) => co.slotKey === slot.key);

  const sorted = [...slot.meetings].sort(
    (a, b) =>
      ((a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)) ||
      toMinutes(a.start) - toMinutes(b.start),
  );

  const confirmDelete = () =>
    Alert.alert(
      'Delete slot?',
      usedBy.length > 0
        ? `${usedBy.length} course${usedBy.length === 1 ? '' : 's'} use this slot. They'll be kept, along with their attendance, but will lose these timings.`
        : 'This slot has no courses attached.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSlot(slot.id);
            router.back();
          },
        },
      ],
    );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl * 2 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.hero, { paddingTop: insets.top + space.md }]}>
        <View style={[styles.heroGlow, { backgroundColor: entry.glow }]} />
        <View style={styles.heroNav}>
          <Squish onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
            <Txt variant="h3" color={colors.textDim}>
              ‹
            </Txt>
          </Squish>
        </View>
        <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
          <Txt variant="tiny" color={entry.base}>
            SLOT {slot.key}
          </Txt>
          <Txt variant="h1" style={{ marginTop: 6 }}>
            {slot.name}
          </Txt>
          <Txt variant="small" color={colors.textDim} style={{ marginTop: 6 }}>
            {slot.meetings.length} meeting{slot.meetings.length === 1 ? '' : 's'} a week ·{' '}
            {usedBy.length} course{usedBy.length === 1 ? '' : 's'} attached
          </Txt>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.lg }}>
        <SectionHeader title="Slot details" />

        <Field label="Name">
          <TextField value={slot.name} onChange={(v) => updateSlot(slot.id, { name: v })} />
        </Field>

        <Field
          label="Key"
          hint="The short tag courses reference. Renaming it moves attached courses across automatically."
        >
          <TextField
            value={slot.key}
            onChange={(v) => updateSlot(slot.id, { key: v.toUpperCase().slice(0, 5) })}
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Colour">
          <ColorPicker value={slot.colorIndex} onChange={(i) => updateSlot(slot.id, { colorIndex: i })} />
        </Field>

        <SectionHeader
          title="Weekly meetings"
          action="+ Add"
          onAction={() => addMeeting(slot.id, { day: 1, start: '09:00', end: '09:50' })}
        />

        {sorted.length === 0 ? (
          <Card padded>
            <Txt variant="small" color={colors.textFaint}>
              No meetings yet. Tap “+ Add” to say when this slot meets.
            </Txt>
          </Card>
        ) : (
          sorted.map((mt) => (
            <Animated.View key={mt.id} entering={FadeInDown.duration(220)} layout={Layout.springify()}>
              <Card padded style={{ marginBottom: space.md }}>
                <Field label="Day">
                  <DayPicker
                    value={mt.day}
                    onChange={(d: DayIndex) => updateMeeting(slot.id, mt.id, { day: d })}
                  />
                </Field>

                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Starts">
                      <TimeField
                        value={mt.start}
                        onChange={(v) => updateMeeting(slot.id, mt.id, { start: v })}
                      />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Ends">
                      <TimeField
                        value={mt.end}
                        onChange={(v) => updateMeeting(slot.id, mt.id, { end: v })}
                      />
                    </Field>
                  </View>
                </View>

                <Field label="Label" hint="Optional tag shown in the grid, e.g. A1.">
                  <TextField
                    value={mt.label ?? ''}
                    onChange={(v) => updateMeeting(slot.id, mt.id, { label: v })}
                    autoCapitalize="characters"
                    placeholder="A1"
                  />
                </Field>

                <Button
                  label="Remove this meeting"
                  tone="danger"
                  onPress={() => deleteMeeting(slot.id, mt.id)}
                />
              </Card>
            </Animated.View>
          ))
        )}

        {usedBy.length > 0 ? (
          <>
            <SectionHeader title={`Courses in this slot · ${usedBy.length}`} />
            <Card padded={false}>
              {usedBy.map((co, i) => {
                const cc = paletteAt(co.colorIndex);
                return (
                  <Squish
                    key={co.id}
                    scaleTo={0.985}
                    onPress={() => router.push(`/course/${co.id}`)}
                    style={[styles.courseRow, i === usedBy.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={[styles.dot, { backgroundColor: cc.base }]} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="small" color={cc.base}>
                        {co.code}
                      </Txt>
                      <Txt variant="body" numberOfLines={1} style={{ marginTop: 2 }}>
                        {co.name}
                      </Txt>
                    </View>
                    <Txt variant="body" color={colors.textFaint}>
                      ›
                    </Txt>
                  </Squish>
                );
              })}
            </Card>
          </>
        ) : null}

        <SectionHeader title="Danger zone" />
        <Button label="Delete slot" tone="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
