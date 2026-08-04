import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { formatTime } from '../lib/schedule';
import { useStore } from '../store';
import { colors, paletteAt, radius, space } from '../theme';
import type { ClassInstance, MarkStatus } from '../types';
import { Squish, Txt } from './ui';

const STATUS_META: Record<MarkStatus, { label: string; color: string; soft: string; glyph: string }> = {
  present: { label: 'Present', color: colors.present, soft: colors.presentSoft, glyph: '✓' },
  absent: { label: 'Absent', color: colors.absent, soft: colors.absentSoft, glyph: '✕' },
  cancelled: { label: 'Cancelled', color: colors.cancelled, soft: colors.cancelledSoft, glyph: '⊘' },
};

const ACTIONS: MarkStatus[] = ['present', 'absent', 'cancelled'];

/**
 * One class occurrence with its three marking actions. Tapping the already
 * selected status clears it, so a mis-tap is one tap to undo.
 */
export function ClassCard({
  instance,
  showDate,
  compact,
}: {
  instance: ClassInstance;
  showDate?: boolean;
  compact?: boolean;
}) {
  const setMark = useStore((s) => s.setMark);
  const router = useRouter();
  const color = paletteAt(instance.course.colorIndex).base;
  const room = instance.meeting.room || instance.course.room;
  const marked = instance.status;

  const onMark = (status: MarkStatus) => {
    setMark(
      instance.course.id,
      instance.date,
      instance.meeting.id,
      marked === status ? null : status,
    );
  };

  return (
    <Animated.View entering={FadeIn.duration(220)} layout={Layout.springify().damping(18)}>
      <View
        style={[
          styles.card,
          marked ? { backgroundColor: STATUS_META[marked].soft } : null,
          { borderColor: marked ? `${STATUS_META[marked].color}33` : colors.border },
        ]}
      >
        <View style={[styles.rail, { backgroundColor: color }]} />

        <Squish
          scaleTo={0.985}
          haptic="none"
          // A one-off opens its own editor — that's the only place its date and
          // time can be changed; the course page has no notion of it.
          onPress={() =>
            router.push(
              instance.oneOff
                ? `/one-off?edit=${instance.oneOff.id}`
                : `/course/${instance.course.id}`,
            )
          }
          style={styles.body}
        >
          <View style={styles.headRow}>
            <View style={styles.timeCol}>
              <Txt variant="h3" color={colors.text}>
                {formatTime(instance.meeting.start)}
              </Txt>
              <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 2 }}>
                {formatTime(instance.meeting.end)}
              </Txt>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.codeRow}>
                <Txt variant="tiny" color={color}>
                  {instance.course.code}
                </Txt>
                {instance.meeting.label ? (
                  <View
                    style={[
                      styles.tag,
                      {
                        backgroundColor: instance.oneOff ? colors.warnSoft : `${color}22`,
                      },
                    ]}
                  >
                    <Txt variant="tiny" color={instance.oneOff ? colors.warn : color}>
                      {instance.meeting.label}
                    </Txt>
                  </View>
                ) : null}
                {showDate ? (
                  <Txt variant="tiny" color={colors.textFaint}>
                    {instance.date.slice(5)}
                  </Txt>
                ) : null}
              </View>

              <Txt variant="h3" numberOfLines={compact ? 1 : 2} style={{ marginTop: 3 }}>
                {instance.course.name}
              </Txt>

              {room || instance.course.faculty ? (
                <Txt variant="small" color={colors.textDim} numberOfLines={1} style={{ marginTop: 4 }}>
                  {[room, instance.course.faculty].filter(Boolean).join(' · ')}
                </Txt>
              ) : null}

              {instance.oneOff?.note ? (
                <Txt variant="small" color={colors.warn} numberOfLines={2} style={{ marginTop: 4 }}>
                  {instance.oneOff.note}
                </Txt>
              ) : null}
            </View>

            {marked ? (
              <View style={[styles.badge, { backgroundColor: STATUS_META[marked].color }]}>
                <Txt variant="small" color={colors.bg}>
                  {STATUS_META[marked].glyph}
                </Txt>
              </View>
            ) : null}
          </View>
        </Squish>

        <View style={styles.actions}>
          {ACTIONS.map((status) => {
            const meta = STATUS_META[status];
            const active = marked === status;
            return (
              <Squish
                key={status}
                scaleTo={0.93}
                haptic={status === 'present' ? 'success' : status === 'absent' ? 'warning' : 'light'}
                onPress={() => onMark(status)}
                style={[
                  styles.action,
                  {
                    backgroundColor: active ? meta.color : colors.surfaceHi,
                    borderColor: active ? meta.color : colors.border,
                  },
                ]}
              >
                <Txt variant="small" color={active ? colors.bg : meta.color}>
                  {meta.label}
                </Txt>
              </Squish>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  body: { paddingLeft: space.lg + 2, paddingRight: space.lg, paddingTop: space.lg },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  timeCol: { width: 62, paddingTop: 1 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    paddingLeft: space.lg + 2,
  },
  action: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
