/** Day index matches JS Date.getDay(): 0 = Sunday … 6 = Saturday. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A single recurring weekly appointment: "Monday 08:00–08:50". */
export type Meeting = {
  id: string;
  day: DayIndex;
  /** "HH:mm", 24h. */
  start: string;
  end: string;
  /** Short tag shown in the grid, e.g. "A1". Optional for custom meetings. */
  label?: string;
  /** Overrides the course room for this one meeting. */
  room?: string;
};

/**
 * A named bundle of weekly meetings — "Slot A" meets 4× a week.
 * Fully user-editable: nothing about the grid is hardcoded into the UI.
 */
export type Slot = {
  id: string;
  /** Short key used to link courses to this slot, e.g. "A", "L1". */
  key: string;
  name: string;
  kind: 'lecture' | 'lab' | 'free' | 'custom';
  meetings: Meeting[];
  /** Index into the palette; drives the slot's colour everywhere. */
  colorIndex: number;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  faculty: string;
  credits: number;
  room: string;
  campus: string;
  /** References Slot.key. null = the course only uses `extraMeetings`. */
  slotKey: string | null;
  /** Meetings on top of (or instead of) the slot's own meetings. */
  extraMeetings: Meeting[];
  /**
   * Ids of the slot's meetings this particular course does NOT attend.
   * Lets one course drop a session its slot nominally has, without editing the
   * slot and disturbing every other course attached to it.
   */
  mutedMeetingIds: string[];
  colorIndex: number;
  /** Per-course attendance requirement in percent; falls back to settings. */
  minAttendance: number | null;
  /**
   * "YYYY-MM-DD" — the first day this course actually met. Classes before it
   * never existed, so they are not scheduled and cannot count against you.
   * Defaults to the day the course was added; move it back to record a course
   * that started earlier, then use Backfill to fill in the history.
   */
  startDate: string | null;
  archived: boolean;
  createdAt: number;
};

/**
 * A class that happens once, on one calendar date — a make-up class, a
 * rescheduled lecture, an extra tutorial. Deliberately NOT a `Meeting`: those
 * are keyed by weekday and repeat forever.
 *
 * The inverse case (a recurring class that does *not* happen once) is already
 * covered by marking that occurrence `cancelled`.
 */
export type OneOffClass = {
  id: string;
  courseId: string;
  /** "YYYY-MM-DD" local time. The single date this class occurs on. */
  date: string;
  start: string;
  end: string;
  room?: string;
  /** Free text, e.g. "Make-up for Tuesday". Shown on the card. */
  note?: string;
  createdAt: number;
};

export type MarkStatus = 'present' | 'absent' | 'cancelled';

/**
 * One attendance decision. Keyed by course + calendar date + meeting,
 * so a slot that meets twice in one day is tracked separately.
 */
export type AttendanceMark = {
  courseId: string;
  /** "YYYY-MM-DD" in local time. */
  date: string;
  meetingId: string;
  status: MarkStatus;
  markedAt: number;
};

export type Settings = {
  reminderEnabled: boolean;
  /** "HH:mm" local time for the daily "did you attend?" nudge. */
  reminderTime: string;
  /** Also nudge only on days that actually have classes. */
  reminderSkipEmptyDays: boolean;
  minAttendance: number;
  /** "YYYY-MM-DD"; classes outside the term are not counted or shown. */
  semesterStart: string | null;
  semesterEnd: string | null;
  /** "YYYY-MM-DD" dates with no classes at all. */
  holidays: string[];
  hapticsEnabled: boolean;
  /** 'system' follows the OS light/dark switch. */
  themePref: 'system' | 'light' | 'dark';
};

/** A concrete occurrence of a class on a specific calendar date. */
export type ClassInstance = {
  key: string;
  course: Course;
  /** For a one-off, this is synthesised from the OneOffClass. */
  meeting: Meeting;
  slot: Slot | null;
  date: string;
  start: Date;
  end: Date;
  status: MarkStatus | null;
  /** Set when this instance came from a OneOffClass rather than a slot. */
  oneOff?: OneOffClass;
};

export type CourseStats = {
  courseId: string;
  present: number;
  absent: number;
  cancelled: number;
  /** present + absent — cancelled classes never count against you. */
  held: number;
  percent: number | null;
  threshold: number;
  /** How many more you may miss and stay at/above threshold. */
  canSkip: number;
  /** How many consecutive classes you must attend to climb back. */
  mustAttend: number;
};
