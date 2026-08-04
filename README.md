# Attendance

An offline-first Android/iOS attendance tracker built around one habit: an
evening notification asking how the day went, and three taps to answer.

Everything lives on the device. No account, no server, no network calls.

## What it does

**Today** — a live countdown to your next class (or time remaining in the one
you're in), a marking streak, an overall attendance ring, a catch-up list of
anything you forgot to log on earlier days, and today's classes with
Present / Absent / Cancelled on each. Tapping a marked status again clears it.

**Timetable** — a colour-coded weekly grid built from your enrolled courses, a
per-day view you can page through, and export to PDF via the system share sheet.

**Courses** — every course with its percentage, a health bar, and the sentence
that actually matters: *"can skip 3 more"* or *"attend 6 in a row to recover"*.
Filter by at-risk. Tap through to a full editor.

**Settings** — reminder time, attendance target, haptics, holidays, and the slot
editor.

## Timetable data

The IIT Mandi non-IC grid ships as seed data:

|       | 08:00 | 09:00 | 10:00 | 11:00 | 12:00 | 14:00–17:00 | 17:00 |
| ----- | ----- | ----- | ----- | ----- | ----- | ----------- | ----- |
| Mon   | A1    | B1    | C1    | D1    | E1    | L1          | F4    |
| Tue   | F1    | G1    | H1    | A2    | B2    | L2          | C4    |
| Wed   | C2    | D2    | F2    | E2    | H2    | L3          | B4    |
| Thu   | G2    | A3    | B3    | C3    | D3    | L4          | E4    |
| Fri   | H3    | E3    | G3    | F3    | A4    | L5          | —     |

All 312 courses from the official chart are bundled as a searchable picker —
choosing one fills in code, name, faculty, credits, slot, room and campus.

**None of this is hardcoded into the UI.** Slots, their weekly meetings, times,
days, labels and colours are all editable in Settings › Time slots, and you can
add or delete slots outright. Courses can also carry their own extra meetings on
top of (or instead of) a slot — useful for a make-up class or a course with no
slot at all.

## How attendance is computed

Cancelled classes are excluded entirely; they never count against you.

```
held    = present + absent
percent = present / held
canSkip    = floor(present / t - held)          # stay at/above target t
mustAttend = ceil((t * held - present) / (1-t)) # consecutive classes to recover
```

Courses can override the global target individually.

## Running it

```bash
npm install
npx expo start          # dev server; press 'a' for Android
```

Notifications **will not fire in Expo Go on Android** (removed in SDK 53+). You
need a development build or an APK:

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android   # → installable APK
```

The `preview` profile produces a plain APK you can sideload. `development`
produces a dev-client build if you want live reload with working notifications.

To build locally instead of on EAS servers you'll need JDK 17+ (JDK 8 is not
enough for modern Android Gradle), then `npx expo run:android`.

## Layout

```
app/                    expo-router screens
  (tabs)/               Today · Timetable · Courses · Settings
  course/[id].tsx       course detail + editor
  slot/[id].tsx         slot editor
  add-course.tsx        catalog search
src/
  lib/schedule.ts       scheduling + attendance math (pure, testable)
  lib/notifications.ts  rolling 14-day reminder window
  lib/export.ts         PDF timetable + JSON backup
  data/slots.ts         the weekly grid
  data/catalog.ts       312 seeded courses
  store.ts              zustand + AsyncStorage
  theme.ts              design tokens
```

## Notes on the reminder

Rather than one repeating daily trigger, the app schedules one notification per
day across a rolling 14-day window and re-arms it whenever the Today screen
renders. That's what lets each day's copy name that day's actual class count,
and what makes "skip empty days" possible at all.
