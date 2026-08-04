import type { DayIndex, Meeting, Slot } from '../types';

/**
 * The IIT Mandi non-IC weekly grid, transcribed from the official slot chart.
 * This only seeds first launch — every slot, meeting and time is editable in
 * Settings › Time slots, and slots can be added or deleted outright.
 *
 *          08:00   09:00   10:00   11:00   12:00   14:00-17:00   17:00
 *  Mon       A1      B1      C1      D1      E1        L1          F4
 *  Tue       F1      G1      H1      A2      B2        L2          C4
 *  Wed       C2      D2      F2      E2      H2        L3          B4
 *  Thu       G2      A3      B3      C3      D3        L4          E4
 *  Fri       H3      E3      G3      F3      A4        L5          —
 */

const MON: DayIndex = 1;
const TUE: DayIndex = 2;
const WED: DayIndex = 3;
const THU: DayIndex = 4;
const FRI: DayIndex = 5;

/** Start time → end time for the standard 50-minute teaching periods. */
const PERIOD_END: Record<string, string> = {
  '08:00': '08:50',
  '09:00': '09:50',
  '10:00': '10:50',
  '11:00': '11:50',
  '12:00': '12:50',
  '17:00': '17:50',
};

function m(label: string, day: DayIndex, start: string, end?: string): Meeting {
  return {
    id: `seed-${label}`,
    label,
    day,
    start,
    end: end ?? PERIOD_END[start] ?? start,
  };
}

export const DEFAULT_SLOTS: Slot[] = [
  {
    id: 'slot-A',
    key: 'A',
    name: 'Slot A',
    kind: 'lecture',
    colorIndex: 0,
    meetings: [
      m('A1', MON, '08:00'),
      m('A2', TUE, '11:00'),
      m('A3', THU, '09:00'),
      m('A4', FRI, '12:00'),
    ],
  },
  {
    id: 'slot-B',
    key: 'B',
    name: 'Slot B',
    kind: 'lecture',
    colorIndex: 1,
    meetings: [
      m('B1', MON, '09:00'),
      m('B2', TUE, '12:00'),
      m('B3', THU, '10:00'),
      m('B4', WED, '17:00'),
    ],
  },
  {
    id: 'slot-C',
    key: 'C',
    name: 'Slot C',
    kind: 'lecture',
    colorIndex: 2,
    meetings: [
      m('C1', MON, '10:00'),
      m('C2', WED, '08:00'),
      m('C3', THU, '11:00'),
      m('C4', TUE, '17:00'),
    ],
  },
  {
    id: 'slot-D',
    key: 'D',
    name: 'Slot D',
    kind: 'lecture',
    colorIndex: 3,
    meetings: [m('D1', MON, '11:00'), m('D2', WED, '09:00'), m('D3', THU, '12:00')],
  },
  {
    id: 'slot-E',
    key: 'E',
    name: 'Slot E',
    kind: 'lecture',
    colorIndex: 4,
    meetings: [
      m('E1', MON, '12:00'),
      m('E2', WED, '11:00'),
      m('E3', FRI, '09:00'),
      m('E4', THU, '17:00'),
    ],
  },
  {
    id: 'slot-F',
    key: 'F',
    name: 'Slot F',
    kind: 'lecture',
    colorIndex: 5,
    meetings: [
      m('F1', TUE, '08:00'),
      m('F2', WED, '10:00'),
      m('F3', FRI, '11:00'),
      m('F4', MON, '17:00'),
    ],
  },
  {
    id: 'slot-G',
    key: 'G',
    name: 'Slot G',
    kind: 'lecture',
    colorIndex: 6,
    meetings: [m('G1', TUE, '09:00'), m('G2', THU, '08:00'), m('G3', FRI, '10:00')],
  },
  {
    id: 'slot-H',
    key: 'H',
    name: 'Slot H',
    kind: 'lecture',
    colorIndex: 7,
    meetings: [m('H1', TUE, '10:00'), m('H2', WED, '12:00'), m('H3', FRI, '08:00')],
  },
  {
    id: 'slot-L1',
    key: 'L1',
    name: 'Lab Slot 1',
    kind: 'lab',
    colorIndex: 8,
    meetings: [m('L1', MON, '14:00', '17:00')],
  },
  {
    id: 'slot-L2',
    key: 'L2',
    name: 'Lab Slot 2',
    kind: 'lab',
    colorIndex: 9,
    meetings: [m('L2', TUE, '14:00', '17:00')],
  },
  {
    id: 'slot-L3',
    key: 'L3',
    name: 'Lab Slot 3',
    kind: 'lab',
    colorIndex: 10,
    meetings: [m('L3', WED, '14:00', '17:00')],
  },
  {
    id: 'slot-L4',
    key: 'L4',
    name: 'Lab Slot 4',
    kind: 'lab',
    colorIndex: 11,
    meetings: [m('L4', THU, '14:00', '17:00')],
  },
  {
    id: 'slot-L5',
    key: 'L5',
    name: 'Lab Slot 5',
    kind: 'lab',
    colorIndex: 8,
    meetings: [m('L5', FRI, '14:00', '17:00')],
  },
  // Free slots have no fixed time on the official chart — the department
  // announces them. Add the meetings yourself once you know them.
  { id: 'slot-FS1', key: 'FS1', name: 'Free Slot 1', kind: 'free', colorIndex: 9, meetings: [] },
  { id: 'slot-FS2', key: 'FS2', name: 'Free Slot 2', kind: 'free', colorIndex: 10, meetings: [] },
  { id: 'slot-FS3', key: 'FS3', name: 'Free Slot 3', kind: 'free', colorIndex: 11, meetings: [] },
];

