import { CATALOG } from '../data/catalog';
import type { Course, Slot } from '../types';
import { courseMeetings, toMinutes } from './schedule';

/**
 * Canonical identity for a room.
 *
 * The chart writes "A17-1A", people type "A17 1A", and the odd entry arrives as
 * "a17_1a". They are one physical room, so every lookup and grouping goes
 * through this: uppercase, punctuation and whitespace stripped.
 */
export function roomKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function sameRoom(a: string, b: string): boolean {
  const ka = roomKey(a);
  return ka !== '' && ka === roomKey(b);
}

/** One course sitting in a room at the inspected moment. */
export type RoomOccupant = {
  code: string;
  name: string;
  faculty: string;
  slotKey: string;
  /** The slot meeting that is live, e.g. 'A1'. */
  meetingLabel: string;
  /** True when this is one of the user's own courses rather than the catalog. */
  mine: boolean;
};

export type RoomState = {
  key: string;
  /** The spelling to show: the variant seen most often across the data. */
  label: string;
  campus: string;
  occupants: RoomOccupant[];
};

export type RoomSnapshot = {
  /** Slot keys with a meeting live at the inspected moment. */
  activeSlots: string[];
  occupied: RoomState[];
  free: RoomState[];
};

type Variant = { counts: Map<string, number>; campus: string };

/**
 * Every room the app knows about, with the best spelling for each.
 *
 * Built from the bundled catalog plus whatever the user has typed on their own
 * courses, so a room that only exists in a hand-made course still shows up.
 */
function buildRegistry(courses: Course[], slots: Slot[]): Map<string, Variant> {
  const reg = new Map<string, Variant>();

  const note = (raw: string | undefined, campus: string) => {
    if (!raw) return;
    const k = roomKey(raw);
    if (!k) return;
    let v = reg.get(k);
    if (!v) {
      v = { counts: new Map(), campus: '' };
      reg.set(k, v);
    }
    const trimmed = raw.trim();
    v.counts.set(trimmed, (v.counts.get(trimmed) ?? 0) + 1);
    if (!v.campus && campus) v.campus = campus;
  };

  for (const c of CATALOG) note(c.room, c.campus);
  for (const co of courses) {
    if (co.archived) continue;
    note(co.room, '');
    // Per-meeting overrides can name a room the course itself never mentions.
    for (const mt of courseMeetings(co, slots)) note(mt.room, '');
  }

  return reg;
}

/**
 * Pick the spelling to display. Frequency first, then prefer the punctuated
 * chart style ("A17-1A" over "A171A"), then the shortest for stability.
 */
function bestLabel(counts: Map<string, number>): string {
  let best = '';
  let bestScore = -1;
  for (const [raw, n] of counts) {
    const score = n * 10 + (/[-\s]/.test(raw) ? 2 : 0);
    if (score > bestScore || (score === bestScore && raw.length < best.length)) {
      best = raw;
      bestScore = score;
    }
  }
  return best;
}

/** Slot key → the label of its meeting that is live at (day, minutes). */
function liveSlots(slots: Slot[], day: number, mins: number): Map<string, string> {
  const live = new Map<string, string>();
  for (const s of slots) {
    for (const mt of s.meetings) {
      if (mt.day !== day) continue;
      if (toMinutes(mt.start) <= mins && mins < toMinutes(mt.end)) {
        live.set(s.key, mt.label ?? s.key);
        break;
      }
    }
  }
  return live;
}

/**
 * Who is in which room at one instant, and which rooms are therefore free.
 *
 * Occupancy comes from the institute catalog crossed with the user's *current*
 * slot timings — editing a slot in Settings moves every course that inherits
 * it, so the checker has to read the live slots rather than the seeded ones.
 * The user's own courses are layered on top and win on conflict, since their
 * per-course overrides are the more specific truth.
 */
export function roomsAt(when: Date, slots: Slot[], courses: Course[]): RoomSnapshot {
  const day = when.getDay();
  const mins = when.getHours() * 60 + when.getMinutes();

  const reg = buildRegistry(courses, slots);
  const live = liveSlots(slots, day, mins);
  const byRoom = new Map<string, RoomOccupant[]>();
  const placed = new Set<string>();

  const add = (room: string | undefined, occ: RoomOccupant) => {
    if (!room) return;
    const k = roomKey(room);
    if (!k) return;
    const dedupe = `${k}|${occ.code}`;
    if (placed.has(dedupe)) return;
    placed.add(dedupe);
    const list = byRoom.get(k);
    if (list) list.push(occ);
    else byRoom.set(k, [occ]);
  };

  // The user's own courses first, so `mine` survives the dedupe against the
  // catalog entry the course was originally picked from.
  for (const co of courses) {
    if (co.archived) continue;
    for (const mt of courseMeetings(co, slots)) {
      if (mt.day !== day) continue;
      if (!(toMinutes(mt.start) <= mins && mins < toMinutes(mt.end))) continue;
      add(mt.room || co.room, {
        code: co.code,
        name: co.name,
        faculty: '',
        slotKey: co.slotKey ?? '',
        meetingLabel: mt.label ?? '',
        mine: true,
      });
    }
  }

  for (const c of CATALOG) {
    const label = live.get(c.slotKey);
    if (!label) continue;
    add(c.room, {
      code: c.code,
      name: c.name,
      faculty: c.faculty,
      slotKey: c.slotKey,
      meetingLabel: label,
      mine: false,
    });
  }

  const occupied: RoomState[] = [];
  const free: RoomState[] = [];

  for (const [key, variant] of reg) {
    const state: RoomState = {
      key,
      label: bestLabel(variant.counts),
      campus: variant.campus,
      occupants: byRoom.get(key) ?? [],
    };
    (state.occupants.length > 0 ? occupied : free).push(state);
  }

  const byLabel = (a: RoomState, b: RoomState) =>
    a.label.localeCompare(b.label, undefined, { numeric: true });

  return {
    activeSlots: [...live.keys()].sort(),
    occupied: occupied.sort(byLabel),
    free: free.sort(byLabel),
  };
}
