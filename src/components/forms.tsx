import React from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { DAY_SHORT, formatTime, fromMinutes, toMinutes } from '../lib/schedule';
import { colors, paletteAt, radius, space } from '../theme';
import type { DayIndex } from '../types';
import { Squish, Txt } from './ui';

/* ------------------------------------------------------------------ field -- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Txt variant="tiny" color={colors.textFaint} style={{ marginBottom: 7 }}>
        {label.toUpperCase()}
      </Txt>
      {children}
      {hint ? (
        <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: 6, letterSpacing: 0 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize = 'sentences',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'characters';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      style={[styles.input, multiline && { minHeight: 78, textAlignVertical: 'top' }]}
    />
  );
}

/* ------------------------------------------------------------------- time -- */

/**
 * "HH:mm" editor. Free text so any timing is expressible, with ±5 min steppers
 * for quick nudges and normalisation on blur so garbage can't be saved.
 */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 4);
    if (digits.length === 0) return setDraft(value);
    const padded = digits.padStart(4, '0');
    const h = Math.min(23, Number(padded.slice(0, 2)));
    const m = Math.min(59, Number(padded.slice(2)));
    const next = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setDraft(next);
    onChange(next);
  };

  const nudge = (mins: number) => {
    const next = fromMinutes(toMinutes(value) + mins);
    setDraft(next);
    onChange(next);
  };

  return (
    <View style={styles.timeRow}>
      <Squish scaleTo={0.88} onPress={() => nudge(-5)} style={styles.stepper}>
        <Txt variant="h3" color={colors.textDim}>
          −
        </Txt>
      </Squish>

      <View style={styles.timeBox}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={() => commit(draft)}
          onSubmitEditing={() => commit(draft)}
          keyboardType="number-pad"
          placeholder="HH:mm"
          placeholderTextColor={colors.textFaint}
          style={styles.timeInput}
          maxLength={5}
        />
        <Txt variant="tiny" color={colors.textFaint}>
          {formatTime(value)}
        </Txt>
      </View>

      <Squish scaleTo={0.88} onPress={() => nudge(5)} style={styles.stepper}>
        <Txt variant="h3" color={colors.textDim}>
          +
        </Txt>
      </Squish>
    </View>
  );
}

/* -------------------------------------------------------------------- day -- */

export function DayPicker({ value, onChange }: { value: DayIndex; onChange: (d: DayIndex) => void }) {
  // Monday-first, matching how the academic week is read.
  const order: DayIndex[] = [1, 2, 3, 4, 5, 6, 0];
  return (
    <View style={styles.dayRow}>
      {order.map((d) => {
        const active = d === value;
        return (
          <Squish
            key={d}
            scaleTo={0.9}
            onPress={() => onChange(d)}
            style={[styles.dayBtn, active && { backgroundColor: colors.accent }]}
          >
            <Txt variant="tiny" color={active ? colors.bg : colors.textDim}>
              {DAY_SHORT[d].slice(0, 2).toUpperCase()}
            </Txt>
          </Squish>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ color -- */

export function ColorPicker({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <View style={styles.colorRow}>
      {Array.from({ length: 12 }, (_, i) => {
        const c = paletteAt(i);
        const active = i === value;
        return (
          <Squish key={i} scaleTo={0.85} onPress={() => onChange(i)}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: c.base },
                active && { borderWidth: 3, borderColor: colors.text },
              ]}
            />
          </Squish>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- rows -- */

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Txt variant="body">{label}</Txt>
        {hint ? (
          <Txt variant="small" color={colors.textFaint} style={{ marginTop: 3, lineHeight: 17 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceHi, true: colors.accent }}
        thumbColor={colors.text}
      />
    </View>
  );
}

export function NavRow({
  label,
  hint,
  value,
  onPress,
  danger,
}: {
  label: string;
  hint?: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Squish scaleTo={0.985} onPress={onPress} style={styles.settingRow}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Txt variant="body" color={danger ? colors.absent : colors.text}>
          {label}
        </Txt>
        {hint ? (
          <Txt variant="small" color={colors.textFaint} style={{ marginTop: 3, lineHeight: 17 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="small" color={colors.textDim} numberOfLines={1} style={{ flexShrink: 0 }}>
          {value}
        </Txt>
      ) : null}
      <Txt variant="body" color={colors.textFaint} style={{ marginLeft: 8 }}>
        ›
      </Txt>
    </Squish>
  );
}

/** Numeric stepper used for percentages and credits. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  suffix = '',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <View style={styles.timeRow}>
      <Squish scaleTo={0.88} onPress={() => onChange(clamp(value - step))} style={styles.stepper}>
        <Txt variant="h3" color={colors.textDim}>
          −
        </Txt>
      </Squish>
      <View style={[styles.timeBox, { alignItems: 'center' }]}>
        <Txt variant="h2">
          {value}
          {suffix}
        </Txt>
      </View>
      <Squish scaleTo={0.88} onPress={() => onChange(clamp(value + step))} style={styles.stepper}>
        <Txt variant="h3" color={colors.textDim}>
          +
        </Txt>
      </Squish>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepper: {
    width: 44,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInput: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 2,
    minWidth: 80,
  },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
