import { DEFAULT_SLOTS } from '../src/data/slots';
import {
  classesOn,
  dateKey,
  markKey,
  nextClass,
  oneOffMeetingId,
  overallStats,
  parseDateKey,
  statsFor,
  teachingDatesBetween,
  unmarkedBefore,
} from '../src/lib/schedule';
import type { AttendanceMark, Course, OneOffClass, Settings } from '../src/types';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
  }
}

const settings: Settings = {
  reminderEnabled: true,
  reminderTime: '19:30',
  reminderSkipEmptyDays: true,
  minAttendance: 75,
  semesterStart: null,
  semesterEnd: null,
  holidays: [],
  hapticsEnabled: true,
};

const mkCourse = (over: Partial<Course> = {}): Course => ({
  id: 'c1',
  code: 'CS-313',
  name: 'Computer Networks',
  faculty: 'X',
  credits: 4,
  room: 'A13-1A',
  campus: 'North',
  slotKey: 'F',
  extraMeetings: [],
  colorIndex: 0,
  minAttendance: null,
  archived: false,
  createdAt: 0,
  ...over,
});

const mkOneOff = (over: Partial<OneOffClass> = {}): OneOffClass => ({
  id: 'o1',
  courseId: 'c1',
  date: '2026-08-03',
  start: '15:00',
  end: '16:00',
  createdAt: 0,
  ...over,
});

/* ------------------------------------------------------------ slot grid -- */

console.log('\n--- slot grid integrity ---');
const A = DEFAULT_SLOTS.find((s) => s.key === 'A')!;
check('slot A meets 4x', A.meetings.length, 4);
check(
  'slot A day/time pairs',
  A.meetings.map((m) => `${m.day}@${m.start}`),
  ['1@08:00', '2@11:00', '4@09:00', '5@12:00'],
);
const seen = new Map<string, string>();
const collisions: string[] = [];
for (const s of DEFAULT_SLOTS) {
  for (const m of s.meetings) {
    const k = `${m.day}@${m.start}`;
    if (seen.has(k)) collisions.push(`${k}: ${seen.get(k)} vs ${s.key}`);
    else seen.set(k, s.key);
  }
}
check('no two slots share a day+time', collisions, []);

/* -------------------------------------------------------------- basics -- */

const monday = new Date(2026, 7, 3); // Monday 3 Aug 2026
console.log('\n--- date helpers ---');
check('that date is Monday', monday.getDay(), 1);
check('dateKey is local, not UTC', dateKey(monday), '2026-08-03');
check('parseDateKey round-trips', dateKey(parseDateKey('2026-08-03')), '2026-08-03');
check('parseDateKey gives local midnight', parseDateKey('2026-08-03').getHours(), 0);

const courseF = mkCourse({ slotKey: 'F' }); // F4 -> Mon 17:00
const courseA = mkCourse({ id: 'c2', code: 'MA-511', slotKey: 'A' }); // A1 -> Mon 08:00

const base = {
  courses: [courseF, courseA],
  slots: DEFAULT_SLOTS,
  marks: {} as Record<string, AttendanceMark>,
  settings,
  oneOffs: [] as OneOffClass[],
};

console.log('\n--- recurring schedule ---');
check('Monday yields 2 classes', classesOn(monday, base).length, 2);
check(
  'sorted chronologically',
  classesOn(monday, base).map((c) => c.meeting.start),
  ['08:00', '17:00'],
);

/* ------------------------------------------------------------- one-offs -- */

console.log('\n--- one-off classes ---');
const withOneOff = { ...base, oneOffs: [mkOneOff()] };
const monWith = classesOn(monday, withOneOff);
check('one-off adds a class', monWith.length, 3);
check(
  'one-off slots into chronological order',
  monWith.map((c) => c.meeting.start),
  ['08:00', '15:00', '17:00'],
);
check('one-off is flagged', monWith[1].oneOff?.id, 'o1');
check('one-off labelled EXTRA', monWith[1].meeting.label, 'EXTRA');
check('recurring classes are not flagged', monWith[0].oneOff, undefined);

check(
  'one-off does not leak to other dates',
  classesOn(new Date(2026, 7, 4), withOneOff).filter((c) => c.oneOff).length,
  0,
);

// A one-off for an archived course must not appear.
check(
  'archived course hides its one-off',
  classesOn(monday, {
    ...withOneOff,
    courses: [{ ...courseF, archived: true }, courseA],
  }).filter((c) => c.oneOff).length,
  0,
);

// A one-off referencing a deleted course must not crash or appear.
check(
  'orphan one-off is ignored',
  classesOn(monday, { ...base, oneOffs: [mkOneOff({ courseId: 'ghost' })] }).length,
  2,
);

console.log('\n--- one-offs vs holidays ---');
const holidaySettings = { ...settings, holidays: [dateKey(monday)] };
const onHoliday = classesOn(monday, { ...withOneOff, settings: holidaySettings });
check('holiday suppresses recurring classes', onHoliday.filter((c) => !c.oneOff).length, 0);
check('but an explicit one-off still shows', onHoliday.filter((c) => c.oneOff).length, 1);

// Same for outside the term.
const outOfTerm = classesOn(monday, {
  ...withOneOff,
  settings: { ...settings, semesterStart: '2026-09-01' },
});
check('term bounds suppress recurring', outOfTerm.filter((c) => !c.oneOff).length, 0);
check('term bounds do not suppress one-offs', outOfTerm.filter((c) => c.oneOff).length, 1);

console.log('\n--- one-off marking ---');
const ooMarkKey = markKey('c1', '2026-08-03', oneOffMeetingId(mkOneOff()));
const markedOneOff: Record<string, AttendanceMark> = {
  [ooMarkKey]: {
    courseId: 'c1',
    date: '2026-08-03',
    meetingId: oneOffMeetingId(mkOneOff()),
    status: 'present',
    markedAt: 0,
  },
};
check(
  'one-off mark is picked up',
  classesOn(monday, { ...withOneOff, marks: markedOneOff }).find((c) => c.oneOff)?.status,
  'present',
);
check(
  'one-off counts toward stats',
  statsFor(mkCourse(), markedOneOff, settings).present,
  1,
);
// The mark key must not collide with a recurring meeting on the same day.
check('one-off key is distinct from slot keys', ooMarkKey.includes('oneoff-o1'), true);

console.log('\n--- one-off affects next class ---');
// At 09:00 Monday the next thing should be the 15:00 one-off, not the 17:00 class.
const at9 = new Date(2026, 7, 3, 9, 0);
check('next class accounts for one-offs', nextClass(at9, withOneOff)?.meeting.start, '15:00');
check('without one-offs it is 17:00', nextClass(at9, base)?.meeting.start, '17:00');

/* ------------------------------------------------------------- backfill -- */

console.log('\n--- teachingDatesBetween ---');
// Mon 3 Aug -> Fri 7 Aug. Slot F meets Mon/Tue/Wed/Fri; slot A Mon/Tue/Thu/Fri.
const week = teachingDatesBetween(new Date(2026, 7, 3), new Date(2026, 7, 7), base);
check('returns only days with classes', week.map((d) => d.getDay()), [1, 2, 3, 4, 5]);

// A course that only meets Monday should yield exactly one date in that week.
const monOnly = teachingDatesBetween(new Date(2026, 7, 3), new Date(2026, 7, 7), {
  ...base,
  courses: [mkCourse({ slotKey: null, extraMeetings: [{ id: 'x', day: 1, start: '10:00', end: '11:00' }] })],
});
check('skips days with nothing scheduled', monOnly.length, 1);
check('and it is the Monday', monOnly[0].getDay(), 1);

check(
  'holidays drop out of the walkthrough',
  teachingDatesBetween(new Date(2026, 7, 3), new Date(2026, 7, 7), {
    ...base,
    settings: { ...settings, holidays: ['2026-08-04', '2026-08-05'] },
  }).map((d) => d.getDay()),
  [1, 4, 5],
);

check(
  'empty range yields nothing',
  teachingDatesBetween(new Date(2026, 7, 8), new Date(2026, 7, 9), base).length,
  0,
);

// Inverted range must not loop forever or throw.
check(
  'inverted range is empty, not infinite',
  teachingDatesBetween(new Date(2026, 7, 9), new Date(2026, 7, 3), base).length,
  0,
);

/* ---------------------------------------------------------------- stats -- */

console.log('\n--- attendance math ---');
const marksOf = (present: number, absent: number, cancelled = 0) => {
  const m: Record<string, AttendanceMark> = {};
  let i = 0;
  const push = (status: AttendanceMark['status'], n: number) => {
    for (let k = 0; k < n; k++, i++) {
      m[markKey('c1', `2026-01-${String(i + 1).padStart(2, '0')}`, `mt${i}`)] = {
        courseId: 'c1',
        date: `d${i}`,
        meetingId: `mt${i}`,
        status,
        markedAt: 0,
      };
    }
  };
  push('present', present);
  push('absent', absent);
  push('cancelled', cancelled);
  return m;
};

let s = statsFor(mkCourse(), marksOf(0, 0), settings);
check('no marks -> null percent', s.percent, null);

s = statsFor(mkCourse(), marksOf(9, 1), settings);
check('9/10 -> 90%', s.percent, 90);
check('9/10 at 75% -> can skip 2', s.canSkip, 2);
check('skipping exactly that many stays >= 75%', (9 / (10 + 2)) * 100 >= 75, true);
check('one more would drop below', (9 / (10 + 3)) * 100 >= 75, false);

s = statsFor(mkCourse(), marksOf(6, 4), settings);
check('6/10 -> must attend 6', s.mustAttend, 6);
check('and that claim holds', ((6 + 6) / (10 + 6)) * 100 >= 75, true);
check('one fewer would not', ((6 + 5) / (10 + 5)) * 100 >= 75, false);

s = statsFor(mkCourse(), marksOf(3, 1, 5), settings);
check('cancelled excluded from held', s.held, 4);
check('cancelled tracked separately', s.cancelled, 5);

const ov = overallStats([courseF, courseA], marksOf(1, 1), settings);
check('overall held', ov.held, 2);

console.log('\n--- unmarked backlog ---');
const at18 = new Date(2026, 7, 3, 18, 0);
check('unmarked includes the one-off', unmarkedBefore(at18, withOneOff, 0).length, 3);
check(
  'marking the one-off clears it',
  unmarkedBefore(at18, { ...withOneOff, marks: markedOneOff }, 0).length,
  2,
);

console.log(failures === 0 ? '\nALL PASSED\n' : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
