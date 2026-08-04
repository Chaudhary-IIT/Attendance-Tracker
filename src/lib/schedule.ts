import type {
  AttendanceMark,
  ClassInstance,
  Course,
  CourseStats,
  DayIndex,
  Meeting,
  Settings,
  Slot,
} from '../types';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local-time "YYYY-MM-DD". Never use toISOString here — it shifts to UTC. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Minutes since midnight for "HH:mm". */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "08:00" → "8:00 AM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function combineDateTime(date: Date, hhmm: string): Date {
  const out = new Date(date);
  const [h, m] = hhmm.split(':').map(Number);
  out.setHours(h || 0, m || 0, 0, 0);
  return out;
}

export function markKey(courseId: string, date: string, meetingId: string): string {
  return `${courseId}|${date}|${meetingId}`;
}

/** All meetings a course actually has: its slot's, plus its own extras. */
export function courseMeetings(course: Course, slots: Slot[]): Meeting[] {
  const slot = course.slotKey ? slots.find((s) => s.key === course.slotKey) : undefined;
  return [...(slot?.meetings ?? []), ...course.extraMeetings];
}

export function findSlot(course: Course, slots: Slot[]): Slot | null {
  if (!course.slotKey) return null;
  return slots.find((s) => s.key === course.slotKey) ?? null;
}

/** True when the date is inside the term and not a declared holiday. */
export function isTeachingDay(date: Date, settings: Settings): boolean {
  const key = dateKey(date);
  if (settings.holidays.includes(key)) return false;
  if (settings.semesterStart && key < settings.semesterStart) return false;
  if (settings.semesterEnd && key > settings.semesterEnd) return false;
  return true;
}

export type ScheduleInput = {
  courses: Course[];
  slots: Slot[];
  marks: Record<string, AttendanceMark>;
  settings: Settings;
};

/** Every class on one calendar date, chronological. Empty on holidays. */
export function classesOn(date: Date, input: ScheduleInput): ClassInstance[] {
  const { courses, slots, marks, settings } = input;
  if (!isTeachingDay(date, settings)) return [];

  const day = date.getDay() as DayIndex;
  const key = dateKey(date);
  const out: ClassInstance[] = [];

  for (const course of courses) {
    if (course.archived) continue;
    const slot = findSlot(course, slots);
    for (const meeting of courseMeetings(course, slots)) {
      if (meeting.day !== day) continue;
      out.push({
        key: markKey(course.id, key, meeting.id),
        course,
        meeting,
        slot,
        date: key,
        start: combineDateTime(date, meeting.start),
        end: combineDateTime(date, meeting.end),
        status: marks[markKey(course.id, key, meeting.id)]?.status ?? null,
      });
    }
  }

  return out.sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.course.code.localeCompare(b.course.code),
  );
}

/**
 * The next class that has not ended yet, scanning forward up to `horizonDays`.
 * Returns null if nothing is scheduled in that window (e.g. term is over).
 */
export function nextClass(
  from: Date,
  input: ScheduleInput,
  horizonDays = 14,
): ClassInstance | null {
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(from, i);
    for (const c of classesOn(day, input)) {
      if (c.end.getTime() > from.getTime()) return c;
    }
  }
  return null;
}

/** The class happening right now, if any. */
export function currentClass(now: Date, input: ScheduleInput): ClassInstance | null {
  return (
    classesOn(now, input).find(
      (c) => c.start.getTime() <= now.getTime() && now.getTime() < c.end.getTime(),
    ) ?? null
  );
}

/**
 * Classes in the past that were never marked, newest first. This is what the
 * evening reminder is really about — it drives the "catch up" prompt.
 */
export function unmarkedBefore(now: Date, input: ScheduleInput, lookbackDays = 14): ClassInstance[] {
  const out: ClassInstance[] = [];
  for (let i = 0; i <= lookbackDays; i++) {
    const day = addDays(now, -i);
    for (const c of classesOn(day, input)) {
      if (c.status == null && c.end.getTime() <= now.getTime()) out.push(c);
    }
  }
  return out.sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function statsFor(course: Course, marks: Record<string, AttendanceMark>, settings: Settings): CourseStats {
  let present = 0;
  let absent = 0;
  let cancelled = 0;

  for (const mark of Object.values(marks)) {
    if (mark.courseId !== course.id) continue;
    if (mark.status === 'present') present++;
    else if (mark.status === 'absent') absent++;
    else cancelled++;
  }

  const held = present + absent;
  const threshold = course.minAttendance ?? settings.minAttendance;
  const t = threshold / 100;
  const percent = held === 0 ? null : (present / held) * 100;

  // present / (held + k) >= t  →  k <= present/t - held
  const canSkip = t <= 0 ? Infinity : Math.max(0, Math.floor(present / t - held));
  // (present + k) / (held + k) >= t  →  k >= (t*held - present) / (1 - t)
  const mustAttend =
    t >= 1 ? Infinity : Math.max(0, Math.ceil((t * held - present) / (1 - t)));

  return {
    courseId: course.id,
    present,
    absent,
    cancelled,
    held,
    percent,
    threshold,
    canSkip: Number.isFinite(canSkip) ? canSkip : 0,
    mustAttend: percent != null && percent >= threshold ? 0 : Number.isFinite(mustAttend) ? mustAttend : 0,
  };
}

/** Aggregate across every active course. */
export function overallStats(courses: Course[], marks: Record<string, AttendanceMark>, settings: Settings) {
  let present = 0;
  let held = 0;
  const active = courses.filter((c) => !c.archived);
  const perCourse = active.map((c) => statsFor(c, marks, settings));

  for (const s of perCourse) {
    present += s.present;
    held += s.held;
  }

  return {
    present,
    held,
    percent: held === 0 ? null : (present / held) * 100,
    atRisk: perCourse.filter((s) => s.percent != null && s.percent < s.threshold).length,
    perCourse,
  };
}

/** Consecutive days ending today on which every past class was marked. */
export function markingStreak(now: Date, input: ScheduleInput, maxDays = 120): number {
  let streak = 0;
  for (let i = 0; i < maxDays; i++) {
    const day = addDays(now, -i);
    const classes = classesOn(day, input).filter((c) => c.end.getTime() <= now.getTime());
    if (classes.length === 0) {
      // A day with no classes never breaks the streak, but does not extend it.
      if (i === 0) continue;
      continue;
    }
    if (classes.every((c) => c.status != null)) streak++;
    else break;
  }
  return streak;
}
