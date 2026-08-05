import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, radius, shadow, space, type } from '../theme';
import { useStore } from '../store';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ------------------------------------------------------------------ text -- */

type TxtProps = TextProps & {
  variant?: keyof typeof type;
  color?: string;
  center?: boolean;
};

export function Txt({ variant = 'body', color = colors.text, center, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[type[variant], { color }, center && { textAlign: 'center' }, style]}
    />
  );
}

/* ---------------------------------------------------------------- haptics -- */

export function useHaptic() {
  const enabled = useStore((s) => s.settings.hapticsEnabled);
  return React.useCallback(
    (kind: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'light') => {
      if (!enabled) return;
      if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (kind === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [enabled],
  );
}

/* -------------------------------------------------------------- pressable -- */

type SquishProps = PressableProps & {
  /** How far it scales down while held. */
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'success' | 'warning' | 'error' | 'none';
  children: React.ReactNode;
};

/**
 * Pressable with a spring squish + haptic tick. Used for anything tappable.
 *
 * Style and transform go on the *same* element. An earlier version nested an
 * Animated.View inside a bare Pressable and styled only the inner view, which
 * meant layout props never reached the element the parent flexbox measures:
 * a `flex: 1` Squish in a row collapsed to its content width and squeezed its
 * children out of the container.
 */
export function Squish({ scaleTo = 0.96, haptic = 'light', onPress, style, children, ...rest }: SquishProps) {
  const scale = useSharedValue(1);
  const fire = useHaptic();

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 380 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') fire(haptic);
        onPress?.(e);
      }}
      style={[style as any, animStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ------------------------------------------------------------------ cards -- */

type CardProps = ViewProps & {
  tint?: string;
  borderColor?: string;
  padded?: boolean;
  elevated?: boolean;
};

export function Card({ tint, borderColor, padded = true, elevated, style, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
        padded && { padding: space.lg },
        tint ? { backgroundColor: tint } : null,
        borderColor ? { borderColor } : null,
        elevated ? shadow.card : null,
        style,
      ]}
    />
  );
}

/** Section heading with an optional trailing action. */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="tiny" color={colors.textFaint} style={{ textTransform: 'uppercase' }}>
        {title}
      </Txt>
      {action ? (
        <Squish onPress={onAction} hitSlop={10}>
          <Txt variant="small" color={colors.accent}>
            {action}
          </Txt>
        </Squish>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ pills -- */

/** Horizontal single-choice selector. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  const body = (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Squish
            key={opt.value}
            scaleTo={0.94}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Txt variant="small" color={active ? colors.bg : colors.textDim}>
              {opt.label}
            </Txt>
          </Squish>
        );
      })}
    </View>
  );

  if (!scroll) return body;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>
      {body}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------- ring -- */

/**
 * Animated progress ring. `percent` is 0–100; null renders an empty track,
 * which is how a course with no marked classes reads.
 */
export function Ring({
  percent,
  size = 120,
  stroke = 11,
  color,
  trackColor = 'rgba(255,255,255,0.07)',
  children,
}: {
  percent: number | null;
  size?: number;
  stroke?: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, percent ?? 0)) / 100, {
      duration: 900,
    });
  }, [percent, progress]);

  // SVG attributes must go through animatedProps, not style.
  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0.55" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animProps}
          // Start the arc at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/** Slim horizontal meter, for per-course rows. */
export function Bar({ percent, color, height = 6 }: { percent: number | null; color: string; height?: number }) {
  const w = useSharedValue(0);
  React.useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, percent ?? 0)), { duration: 700 });
  }, [percent, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View style={[styles.barTrack, { height, borderRadius: height }]}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color }, style]} />
    </View>
  );
}

/* ------------------------------------------------------------------ misc --- */

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44, marginBottom: space.md }}>{icon}</Text>
      <Txt variant="h2" center>
        {title}
      </Txt>
      <Txt variant="body" color={colors.textDim} center style={{ marginTop: space.sm, lineHeight: 21 }}>
        {body}
      </Txt>
      {actionLabel ? (
        <Squish onPress={onAction} haptic="medium" style={styles.emptyBtn}>
          <Txt variant="h3" color={colors.bg}>
            {actionLabel}
          </Txt>
        </Squish>
      ) : null}
    </View>
  );
}

export function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

/** Full-width primary button. */
export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewProps['style'];
}) {
  const bg =
    tone === 'primary' ? colors.accent : tone === 'danger' ? colors.absentSoft : colors.surfaceHi;
  const fg = tone === 'primary' ? colors.bg : tone === 'danger' ? colors.absent : colors.text;

  return (
    <Squish
      onPress={disabled ? undefined : onPress}
      haptic="medium"
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, style]}
    >
      <Txt variant="h3" color={fg}>
        {label}
      </Txt>
    </Squish>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    marginTop: space.xl,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.text },
  barTrack: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    width: '100%',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: space.xl,
  },
  emptyBtn: {
    marginTop: space.xl,
    backgroundColor: colors.accent,
    paddingHorizontal: space.xxl,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
