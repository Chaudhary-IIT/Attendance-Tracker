import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SLOTS } from './data/slots';
import { dateKey, markKey } from './lib/schedule';
import type {
  AttendanceMark,
  Course,
  MarkStatus,
  Meeting,
  OneOffClass,
  Settings,
  Slot,
} from './types';

const STORAGE_KEY = 'attendance-tracker/v1';

export const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: true,
  reminderTime: '19:30',
  reminderSkipEmptyDays: true,
  minAttendance: 75,
  semesterStart: null,
  semesterEnd: null,
  holidays: [],
  hapticsEnabled: true,
};

/** Collision-resistant enough for a single-device local store. */
export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type Persisted = {
  courses: Course[];
  slots: Slot[];
  marks: Record<string, AttendanceMark>;
  settings: Settings;
  oneOffs: OneOffClass[];
};

type State = Persisted & {
  hydrated: boolean;

  hydrate: () => Promise<void>;

  addCourse: (course: Omit<Course, 'id' | 'createdAt'>) => string;
  updateCourse: (id: string, patch: Partial<Course>) => void;
  deleteCourse: (id: string) => void;

  addSlot: (slot: Omit<Slot, 'id'>) => string;
  updateSlot: (id: string, patch: Partial<Slot>) => void;
  deleteSlot: (id: string) => void;
  addMeeting: (slotId: string, meeting: Omit<Meeting, 'id'>) => void;
  updateMeeting: (slotId: string, meetingId: string, patch: Partial<Meeting>) => void;
  deleteMeeting: (slotId: string, meetingId: string) => void;

  addOneOff: (oneOff: Omit<OneOffClass, 'id' | 'createdAt'>) => string;
  updateOneOff: (id: string, patch: Partial<OneOffClass>) => void;
  deleteOneOff: (id: string) => void;

  setMark: (courseId: string, date: string, meetingId: string, status: MarkStatus | null) => void;
  clearMarksFor: (courseId: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  toggleHoliday: (date: string) => void;

  resetAll: () => Promise<void>;
};

/**
 * Writes are debounced so rapid tapping (marking a whole day at once) does not
 * hammer AsyncStorage; the trailing write always wins.
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(get: () => State) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { courses, slots, marks, settings, oneOffs } = get();
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ courses, slots, marks, settings, oneOffs }),
    ).catch(
      (err) => console.warn('[store] save failed', err),
    );
  }, 200);
}

export const useStore = create<State>((set, get) => {
  const commit = (patch: Partial<Persisted>) => {
    set(patch as Partial<State>);
    scheduleSave(get);
  };

  return {
    courses: [],
    slots: DEFAULT_SLOTS,
    marks: {},
    settings: DEFAULT_SETTINGS,
    oneOffs: [],
    hydrated: false,

    hydrate: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Persisted>;
          set({
            courses: parsed.courses ?? [],
            // An empty slot list would leave the user stranded with no grid.
            slots: parsed.slots?.length ? parsed.slots : DEFAULT_SLOTS,
            marks: parsed.marks ?? {},
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
            // Absent in v1 payloads written before one-off classes existed.
            oneOffs: parsed.oneOffs ?? [],
          });
        }
      } catch (err) {
        console.warn('[store] hydrate failed, starting fresh', err);
      } finally {
        set({ hydrated: true });
      }
    },

    addCourse: (course) => {
      const id = uid('course');
      commit({ courses: [...get().courses, { ...course, id, createdAt: Date.now() }] });
      return id;
    },

    updateCourse: (id, patch) =>
      commit({ courses: get().courses.map((c) => (c.id === id ? { ...c, ...patch, id } : c)) }),

    deleteCourse: (id) => {
      const marks = { ...get().marks };
      for (const key of Object.keys(marks)) {
        if (marks[key].courseId === id) delete marks[key];
      }
      commit({ courses: get().courses.filter((c) => c.id !== id), marks });
    },

    addSlot: (slot) => {
      const id = uid('slot');
      commit({ slots: [...get().slots, { ...slot, id }] });
      return id;
    },

    updateSlot: (id, patch) => {
      const prev = get().slots.find((s) => s.id === id);
      const slots = get().slots.map((s) => (s.id === id ? { ...s, ...patch, id } : s));
      // Renaming a slot key must not orphan the courses pointing at it.
      const courses =
        prev && patch.key && patch.key !== prev.key
          ? get().courses.map((c) => (c.slotKey === prev.key ? { ...c, slotKey: patch.key! } : c))
          : get().courses;
      commit({ slots, courses });
    },

    deleteSlot: (id) => {
      const slot = get().slots.find((s) => s.id === id);
      if (!slot) return;
      commit({
        slots: get().slots.filter((s) => s.id !== id),
        // Detach rather than delete — the user keeps the course and its history.
        courses: get().courses.map((c) => (c.slotKey === slot.key ? { ...c, slotKey: null } : c)),
      });
    },

    addMeeting: (slotId, meeting) =>
      commit({
        slots: get().slots.map((s) =>
          s.id === slotId ? { ...s, meetings: [...s.meetings, { ...meeting, id: uid('mt') }] } : s,
        ),
      }),

    updateMeeting: (slotId, meetingId, patch) =>
      commit({
        slots: get().slots.map((s) =>
          s.id === slotId
            ? {
                ...s,
                meetings: s.meetings.map((mt) =>
                  mt.id === meetingId ? { ...mt, ...patch, id: meetingId } : mt,
                ),
              }
            : s,
        ),
      }),

    deleteMeeting: (slotId, meetingId) =>
      commit({
        slots: get().slots.map((s) =>
          s.id === slotId ? { ...s, meetings: s.meetings.filter((mt) => mt.id !== meetingId) } : s,
        ),
      }),

    addOneOff: (oneOff) => {
      const id = uid('oneoff');
      commit({ oneOffs: [...get().oneOffs, { ...oneOff, id, createdAt: Date.now() }] });
      return id;
    },

    updateOneOff: (id, patch) =>
      commit({ oneOffs: get().oneOffs.map((o) => (o.id === id ? { ...o, ...patch, id } : o)) }),

    deleteOneOff: (id) => {
      const oneOff = get().oneOffs.find((o) => o.id === id);
      const marks = { ...get().marks };
      // Drop the attendance mark too, or it would linger unreachable forever.
      if (oneOff) delete marks[markKey(oneOff.courseId, oneOff.date, `oneoff-${oneOff.id}`)];
      commit({ oneOffs: get().oneOffs.filter((o) => o.id !== id), marks });
    },

    setMark: (courseId, date, meetingId, status) => {
      const key = markKey(courseId, date, meetingId);
      const marks = { ...get().marks };
      if (status == null) delete marks[key];
      else marks[key] = { courseId, date, meetingId, status, markedAt: Date.now() };
      commit({ marks });
    },

    clearMarksFor: (courseId) => {
      const marks = { ...get().marks };
      for (const key of Object.keys(marks)) {
        if (marks[key].courseId === courseId) delete marks[key];
      }
      commit({ marks });
    },

    updateSettings: (patch) => commit({ settings: { ...get().settings, ...patch } }),

    toggleHoliday: (date) => {
      const holidays = get().settings.holidays;
      commit({
        settings: {
          ...get().settings,
          holidays: holidays.includes(date)
            ? holidays.filter((d) => d !== date)
            : [...holidays, date].sort(),
        },
      });
    },

    resetAll: async () => {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({
        courses: [],
        slots: DEFAULT_SLOTS,
        marks: {},
        settings: DEFAULT_SETTINGS,
        oneOffs: [],
      });
    },

  };
});

/** Stable selector helpers so components subscribe to the narrowest slice. */
/**
 * The bundle of state the scheduling engine needs.
 *
 * MUST be wrapped in `useShallow`. Zustand v5 compares selector results with
 * `Object.is` through `useSyncExternalStore`, so a selector that builds a fresh
 * object literal looks different on every render and re-renders forever
 * ("Maximum update depth exceeded"). `useShallow` compares the fields instead
 * and hands back the previous object when they all match, which also keeps the
 * reference stable enough to use in `useMemo` dependency lists.
 *
 * Use the `useScheduleInput()` hook below rather than passing this to
 * `useStore` directly.
 */
const scheduleInputSelector = (s: State) => ({
  courses: s.courses,
  slots: s.slots,
  marks: s.marks,
  settings: s.settings,
  oneOffs: s.oneOffs,
});

export function useScheduleInput() {
  return useStore(useShallow(scheduleInputSelector));
}

export const todayKey = () => dateKey(new Date());
