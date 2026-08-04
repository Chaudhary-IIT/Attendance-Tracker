import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Squish, Txt } from '../src/components/ui';
import { CATALOG } from '../src/data/catalog';
import { useStore } from '../src/store';
import { colors, paletteAt, radius, space } from '../src/theme';
import type { CatalogCourse } from '../src/types-catalog';

/** Normalises a search term: case- and separator-insensitive. */
function norm(s: string) {
  return s.toLowerCase().replace(/[_\-\s.]/g, '');
}

export default function AddCourseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const courses = useStore((s) => s.courses);
  const slots = useStore((s) => s.slots);
  const addCourse = useStore((s) => s.addCourse);

  const [query, setQuery] = React.useState('');
  const [slotFilter, setSlotFilter] = React.useState<string>('all');

  const takenCodes = React.useMemo(() => new Set(courses.map((c) => c.code)), [courses]);

  const results = React.useMemo(() => {
    const q = norm(query.trim());
    return CATALOG.filter((c) => {
      if (slotFilter !== 'all' && c.slotKey !== slotFilter) return false;
      if (!q) return true;
      return (
        norm(c.code).includes(q) || norm(c.name).includes(q) || norm(c.faculty).includes(q)
      );
    }).slice(0, 250);
  }, [query, slotFilter]);

  const slotOptions = React.useMemo(() => {
    const keys = [...new Set(CATALOG.map((c) => c.slotKey))].sort();
    return [{ value: 'all', label: 'All' }, ...keys.map((k) => ({ value: k, label: k }))];
  }, []);

  const pick = (entry: CatalogCourse) => {
    // A catalog slot key only links up if a slot with that key actually exists.
    const slotKey = slots.some((s) => s.key === entry.slotKey) ? entry.slotKey : null;
    const id = addCourse({
      code: entry.code,
      name: entry.name,
      faculty: entry.faculty,
      credits: entry.credits,
      room: entry.room,
      campus: entry.campus,
      slotKey,
      extraMeetings: [],
      colorIndex: courses.length,
      minAttendance: null,
      archived: false,
    });
    router.replace(`/course/${id}?created=1`);
  };

  const createBlank = () => {
    const id = addCourse({
      code: query.trim().toUpperCase() || 'NEW',
      name: query.trim() || 'Untitled course',
      faculty: '',
      credits: 3,
      room: '',
      campus: '',
      slotKey: null,
      extraMeetings: [],
      colorIndex: courses.length,
      minAttendance: null,
      archived: false,
    });
    router.replace(`/course/${id}?created=1`);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <Squish onPress={() => router.back()} style={styles.backBtn} scaleTo={0.9}>
          <Txt variant="h3" color={colors.textDim}>
            ‹
          </Txt>
        </Squish>
        <View style={{ flex: 1 }}>
          <Txt variant="h2">Add a course</Txt>
          <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
            {CATALOG.length} IN CATALOG
          </Txt>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Txt variant="body" color={colors.textFaint}>
          ⌕
        </Txt>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search code, name or faculty…"
          placeholderTextColor={colors.textFaint}
          style={styles.search}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <Squish onPress={() => setQuery('')} hitSlop={12} scaleTo={0.85}>
            <Txt variant="small" color={colors.textFaint}>
              ✕
            </Txt>
          </Squish>
        ) : null}
      </View>

      <View style={{ height: 46, marginBottom: space.md }}>
        <FlatList
          horizontal
          data={slotOptions}
          keyExtractor={(o) => o.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: 7, alignItems: 'center' }}
          renderItem={({ item }) => {
            const active = slotFilter === item.value;
            return (
              <Squish
                scaleTo={0.92}
                onPress={() => setSlotFilter(item.value)}
                style={[styles.chip, active && { backgroundColor: colors.text }]}
              >
                <Txt variant="tiny" color={active ? colors.bg : colors.textDim}>
                  {item.label === 'NONE' ? 'NO SLOT' : item.label}
                </Txt>
              </Squish>
            );
          }}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item, i) => `${item.code}-${i}`}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ paddingTop: space.xxl, alignItems: 'center' }}>
            <Txt variant="h3" color={colors.textDim}>
              No match in the catalog
            </Txt>
            <Txt variant="small" color={colors.textFaint} center style={{ marginTop: space.sm }}>
              You can still create it yourself — everything is editable afterwards.
            </Txt>
          </View>
        }
        renderItem={({ item, index }) => {
          const taken = takenCodes.has(item.code);
          const c = paletteAt(index);
          return (
            <Animated.View entering={FadeIn.duration(160)}>
              <Squish
                scaleTo={0.98}
                onPress={() => (taken ? undefined : pick(item))}
                haptic={taken ? 'none' : 'medium'}
                style={[styles.item, taken && { opacity: 0.4 }]}
              >
                <View style={styles.itemTop}>
                  <Txt variant="tiny" color={c.base}>
                    {item.code}
                  </Txt>
                  <View style={[styles.slotBadge, { backgroundColor: `${c.base}1F` }]}>
                    <Txt variant="tiny" color={c.base}>
                      {item.slotKey === 'NONE' ? 'NO SLOT' : item.slotKey}
                    </Txt>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Txt variant="tiny" color={colors.textFaint}>
                    {taken ? 'ADDED' : `${item.credits} CR`}
                  </Txt>
                </View>

                <Txt variant="h3" numberOfLines={2} style={{ marginTop: 4 }}>
                  {item.name}
                </Txt>

                <Txt variant="small" color={colors.textDim} numberOfLines={1} style={{ marginTop: 3 }}>
                  {[item.faculty, item.room, item.campus && `${item.campus} Campus`]
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
              </Squish>
            </Animated.View>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button
          label={query.trim() ? `Create "${query.trim()}" manually` : 'Create a custom course'}
          tone="ghost"
          onPress={createBlank}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 13 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.sm,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  slotBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
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
  },
});
