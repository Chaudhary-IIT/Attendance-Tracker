import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, TextField, TimeField } from '../src/components/forms';
import { Button, Card, SectionHeader, Squish, Txt } from '../src/components/ui';
import { DAY_NAMES, addDays, dateKey, parseDateKey } from '../src/lib/schedule';
import { useStore } from '../src/store';
import { colors, paletteAt, radius, space } from '../src/theme';

/**
 * Create or edit a class that happens exactly once — a make-up lecture, an
 * extra tutorial, a rescheduled session. Distinct from a course's recurring
 * meetings, which repeat every week forever.
 *
 * Params: `date` (YYYY-MM-DD) preselects the day; `edit` (id) opens an
 * existing one-off; `course` preselects the course.
 */
export default function OneOffScreen() {
  const params = useLocalSearchParams<{ date?: string; edit?: string; course?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const courses = useStore((s) => s.courses);
  const oneOffs = useStore((s) => s.oneOffs);
  const addOneOff = useStore((s) => s.addOneOff);
  const updateOneOff = useStore((s) => s.updateOneOff);
  const deleteOneOff = useStore((s) => s.deleteOneOff);

  const existing = params.edit ? oneOffs.find((o) => o.id === params.edit) : undefined;
  const active = courses.filter((c) => !c.archived);

  const [courseId, setCourseId] = React.useState(
    existing?.courseId ?? params.course ?? active[0]?.id ?? '',
  );
  const [date, setDate] = React.useState(existing?.date ?? params.date ?? dateKey(new Date()));
  const [start, setStart] = React.useState(existing?.start ?? '09:00');
  const [end, setEnd] = React.useState(existing?.end ?? '09:50');
  const [room, setRoom] = React.useState(existing?.room ?? '');
  const [note, setNote] = React.useState(existing?.note ?? '');

  const selected = active.find((c) => c.id === courseId);
  const dateObj = parseDateKey(date);

  const shiftDate = (days: number) => setDate(dateKey(addDays(dateObj, days)));

  const save = () => {
    if (!courseId) {
      Alert.alert('Pick a course', 'A one-off class has to belong to a course.');
      return;
    }
    const payload = {
      courseId,
      date,
      start,
      end,
      room: room.trim() || undefined,
      note: note.trim() || undefined,
    };
    if (existing) updateOneOff(existing.id, payload);
    else addOneOff(payload);
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete this class?', 'The extra class and its attendance mark will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (existing) deleteOneOff(existing.id);
          router.back();
        },
      },
    ]);

  if (active.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.xxl, alignItems: 'center' }]}>
        <Txt variant="h2">No courses yet</Txt>
        <Txt variant="small" color={colors.textDim} center style={{ marginTop: space.sm, paddingHorizontal: space.xl }}>
          Add a course first — an extra class has to belong to one.
        </Txt>
        <Button label="Go back" tone="ghost" onPress={() => router.back()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: insets.bottom + space.xxl * 2,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Squish onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
          <Txt variant="h3" color={colors.textDim}>
            ‹
          </Txt>
        </Squish>
        <View style={{ flex: 1 }}>
          <Txt variant="h2">{existing ? 'Edit extra class' : 'Extra class'}</Txt>
          <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
            HAPPENS ONCE, ON ONE DATE
          </Txt>
        </View>
      </View>

      <SectionHeader title="Course" />
      <View style={styles.courseGrid}>
        {active.map((c) => {
          const col = paletteAt(c.colorIndex);
          const on = c.id === courseId;
          return (
            <Squish
              key={c.id}
              scaleTo={0.94}
              onPress={() => setCourseId(c.id)}
              style={[
                styles.courseChip,
                on ? { backgroundColor: col.base, borderColor: col.base } : null,
              ]}
            >
              <Txt variant="tiny" color={on ? colors.bg : colors.textDim}>
                {c.code}
              </Txt>
            </Squish>
          );
        })}
      </View>
      {selected ? (
        <Txt variant="small" color={colors.textDim} style={{ marginTop: space.sm }}>
          {selected.name}
        </Txt>
      ) : null}

      <SectionHeader title="Date" />
      <Card padded={false}>
        <View style={styles.dateRow}>
          <Squish onPress={() => shiftDate(-1)} style={styles.navBtn} scaleTo={0.9}>
            <Txt variant="h3" color={colors.textDim}>
              ‹
            </Txt>
          </Squish>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="h3">{DAY_NAMES[dateObj.getDay()]}</Txt>
            <Txt variant="small" color={colors.textDim} style={{ marginTop: 2 }}>
              {dateObj.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Txt>
          </View>
          <Squish onPress={() => shiftDate(1)} style={styles.navBtn} scaleTo={0.9}>
            <Txt variant="h3" color={colors.textDim}>
              ›
            </Txt>
          </Squish>
        </View>
        <View style={styles.quickRow}>
          {[
            { label: 'Today', days: 0 },
            { label: 'Tomorrow', days: 1 },
            { label: '+1 week', days: 7 },
          ].map((q) => (
            <Squish
              key={q.label}
              scaleTo={0.92}
              onPress={() => setDate(dateKey(addDays(new Date(), q.days)))}
              style={styles.quickChip}
            >
              <Txt variant="tiny" color={colors.textDim}>
                {q.label}
              </Txt>
            </Squish>
          ))}
        </View>
      </Card>

      <SectionHeader title="Time" />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Starts">
            <TimeField value={start} onChange={setStart} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Ends">
            <TimeField value={end} onChange={setEnd} />
          </Field>
        </View>
      </View>

      <Field label="Room" hint={`Leave blank to use ${selected?.room || 'the course room'}.`}>
        <TextField
          value={room}
          onChange={setRoom}
          autoCapitalize="characters"
          placeholder={selected?.room || 'Room'}
        />
      </Field>

      <Field label="Note" hint="Optional — shows on the class card.">
        <TextField value={note} onChange={setNote} placeholder="Make-up for Tuesday" />
      </Field>

      <Button label={existing ? 'Save changes' : 'Add extra class'} onPress={save} />

      {existing ? (
        <Button
          label="Delete this class"
          tone="danger"
          onPress={confirmDelete}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  courseChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
  },
});
