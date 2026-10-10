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

**Settings** — reminder time, attendance target, haptics, holidays, the slot
editor, backfill, one-off classes, appearance (System / Light / Dark), a
notification health check with a "send a test" button and shortcuts to the
system and battery settings, PDF timetable export, and a full JSON backup.

**Free classrooms** — Settings › Free classrooms shows which rooms are occupied
right now, or at any day and time you pick. It's computed from the whole bundled
catalog crossed with the slot grid, so it covers the institute, not just your
own courses. Room spellings like `A17-1A`, `A17 1A` and `a17_1a` are treated as
the same room.

**Extra (one-off) classes** — a make-up lecture or rescheduled session on a
single date, added from Today, the timetable day view, or Settings. These are
distinct from a course's recurring meetings and never repeat. The inverse case,
a regular class that didn't happen, is just marking that occurrence *Cancelled*.

**Backfill** — pick how far back to go, then step through each past teaching day
marking what you attended, with "all present" / "all cancelled" shortcuts. Days
with no classes are skipped, so a month is a short walk.

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

## Tests

```bash
npm run test        # 45 assertions over the scheduling and attendance logic
npm run typecheck
```

Covers the slot grid (including that no two slots claim the same day+time),
one-off merging and isolation, holiday/term gating, the backfill date walk, and
the "can skip N" / "must attend N" arithmetic — each verified against the
resulting percentage rather than just the formula.

## How attendance is computed

Cancelled classes are excluded entirely; they never count against you.

```
held    = present + absent
percent = present / held
canSkip    = floor(present / t - held)          # stay at/above target t
mustAttend = ceil((t * held - present) / (1-t)) # consecutive classes to recover
```

Courses can override the global target individually.

## Just want the app?

Download `app-release.apk` from the
[latest release](https://github.com/Chaudhary-IIT/Attendance-Tracker/releases/latest),
open it on your Android phone and allow "install unknown apps" when asked. It's
an arm64 build, which covers essentially every Android phone since ~2017.

## Getting started (fresh clone)

### Prerequisites

| Tool | Version | Needed for |
| ---- | ------- | ---------- |
| [Node.js](https://nodejs.org/) | 20 LTS or newer (developed on 22.18) | everything |
| npm | ships with Node (developed on 10.9) | installing dependencies |
| Git | any recent | cloning |
| [Expo Go](https://expo.dev/go) on your phone | must support **SDK 57** | quick UI testing only |
| [Android Studio](https://developer.android.com/studio) (SDK + bundled JDK 17+) | recent | building an APK locally |
| `eas-cli` + a free Expo account | ≥ 5.0 | building in the cloud instead |

The stack is **Expo SDK 57**, React Native 0.86, React 19.2, expo-router,
zustand and TypeScript 6. Exact versions are pinned in `package.json` and
`package-lock.json`, both committed.

### Steps

```bash
git clone https://github.com/Chaudhary-IIT/Attendance-Tracker.git
cd Attendance-Tracker
npm ci                  # exact versions from package-lock.json (or: npm install)

npm run typecheck       # should print nothing
npm run test            # should end with "ALL PASSED"

npx expo start          # dev server; press 'a' for Android, or scan the QR with Expo Go
```

You don't need any `.env` file, API key or backend: the app makes no network
calls. `node_modules/`, `.expo/`, `android/`, `ios/` and build output are
gitignored and regenerated by the commands in this section.

Notifications **will not fire in Expo Go on Android** (removed in SDK 53+). You
need a real build, either local (below) or via EAS.

### Your data is on the phone, not in this repo

Courses, marks and settings are stored in the app's AsyncStorage on the device.
Deleting the project folder or recloning doesn't touch them. Uninstalling the app
does. Before uninstalling, use Settings › *Export full backup (JSON)*. There is no
import screen yet, so that file is a record, not a one-tap restore.

Installing a newer APK over the old one (`adb install -r`) keeps your data, as
long as both are signed with the same key. The stock debug keystore that
`prebuild` generates is the same file every time, so locally built APKs
upgrade cleanly.

### Building an APK locally

Requires the Android SDK and JDK 17+. Android Studio bundles a suitable JDK at
`<studio>/jbr`, so you usually don't need a separate install — a system JDK 8 is
*not* enough for modern Android Gradle.

```bash
npx expo prebuild --platform android --clean

cd android
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
./gradlew assembleRelease
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`.
Install it with `adb install -r <path>`, or copy it to the phone and open it.

Note this release build is signed with React Native's stock **debug keystore**
(see `android/app/build.gradle`). That's fine for sideloading onto your own
device, but it is not a distributable signature — generate your own keystore
before publishing anywhere.

`android/` and `ios/` are gitignored; they're generated by `prebuild` and
regenerating them is the intended workflow.

### Building via EAS instead

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android   # → installable APK
```

`preview` produces a plain sideloadable APK; `development` produces a dev-client
build if you want live reload with working notifications.

## Layout

```
app/                    expo-router screens
  (tabs)/               Today · Timetable · Courses · Settings
  course/[id].tsx       course detail + editor
  slot/[id].tsx         slot editor
  add-course.tsx        catalog search
  slots.tsx             list of time slots
  one-off.tsx           add/edit a single-date class
  backfill.tsx          guided day-by-day catch-up
  rooms.tsx             free / occupied classrooms
src/
  lib/schedule.ts       scheduling + attendance math (pure, testable)
  lib/notifications.ts  rolling 14-day reminder window
  lib/export.ts         PDF timetable + JSON backup
  lib/rooms.ts          room occupancy from catalog × slot grid
  data/slots.ts         the weekly grid
  data/catalog.ts       312 seeded courses
  components/           shared UI, forms, class card
  hooks.ts              small shared hooks (e.g. a ticking clock)
  store.ts              zustand + AsyncStorage
  theme.ts              light + dark design tokens
  theme-context.tsx     theme provider, useColors / useThemedStyles
tests/logic.test.ts     scheduling + attendance assertions
app.json                Expo config (package id com.naman.attendancetracker)
eas.json                EAS build profiles
```

## Build note: low-memory machines

A fresh `prebuild` builds all four Android ABIs. On an 8GB machine that can run
out of memory. In that case, edit `android/gradle.properties` after `prebuild`:

```properties
reactNativeArchitectures=arm64-v8a
org.gradle.workers.max=2
org.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m
```

The last line matters: with prebuild's default 512 MB metaspace, the build dies
near the end at `:app:mergeExtDexRelease` with
`java.lang.OutOfMemoryError: Metaspace`. If that happens, raise it, run
`./gradlew --stop`, and rerun. Everything already compiled is cached, so the
retry only takes a few minutes.

Every Android phone since roughly 2017 is arm64; keep `x86_64` if you need an
emulator build. Because `android/` is regenerated by `prebuild`, that edit does
not survive a `--clean`. Reapply it, or move the setting into `app.json` via
`expo-build-properties`. You can also skip the PC build entirely and use EAS.

## Notes on the reminder

Rather than one repeating daily trigger, the app schedules one notification per
day across a rolling 14-day window and re-arms it whenever the Today screen
renders. That's what lets each day's copy name that day's actual class count,
and what makes "skip empty days" possible at all.
