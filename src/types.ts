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
  colorIndex: number;
  /** Per-course attendance requirement in percent; falls back to settings. */
  minAttendance: number | null;
  archived: boolean;
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
};

/** A concrete occurrence of a meeting on a specific calendar date. */
export type ClassInstance = {
  key: string;
  course: Course;
  meeting: Meeting;
  slot: Slot | null;
  date: string;
  start: Date;
  end: Date;
  status: MarkStatus | null;
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
