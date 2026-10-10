import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ClassInstance, Settings } from '../types';
import { addDays, classesOn, combineDateTime, dateKey, type ScheduleInput } from './schedule';

const CHANNEL_ID = 'attendance-reminders';

/** How many days ahead we pre-schedule. iOS caps pending notifications at 64. */
const HORIZON_DAYS = 14;

/** Tag on every notification we create, so we can cancel selectively. */
type Kind = 'daily' | 'class-ping' | 'test';

/**
 * Stable identifiers, and the reason they matter.
 *
 * expo-notifications turns each scheduled notification into an AlarmManager
 * alarm whose PendingIntent is keyed by the notification's identifier. Letting
 * it mint a random UUID each time meant every reschedule produced a *new*
 * alarm, and cancelling relied on the JS-side store still listing the old one.
 * Any interruption between arming the alarm and persisting that record — a
 * force-stop, a reinstall, two reschedules racing — orphaned an alarm that JS
 * could no longer see, let alone cancel. They accumulated into hundreds of
 * duplicate evening pings.
 *
 * Deriving the identifier from the thing being scheduled fixes it structurally:
 * the same date always maps to the same PendingIntent, so AlarmManager replaces
 * the alarm instead of adding another, and a leaked alarm heals on the next run.
 */
const dailyId = (date: string) => `daily-${date}`;
const PING_ID = 'class-ping';

/**
 * Serialises reschedules.
 *
 * `rescheduleReminders` is fired from a React effect that can re-run several
 * times in quick succession. Two overlapping runs would each read the pending
 * list before either had finished writing, so both would skip the other's
 * cancellations and double the schedule. Chaining them keeps cancel-then-write
 * atomic with respect to each other.
 */
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

/** Extra payload we attach so diagnostics never have to parse trigger objects. */
type Payload = { kind: Kind; fireAt?: number; date?: string };

/** Foreground presentation: still show the banner while the app is open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return null;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Attendance reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#6D5BFF',
    // No `sound` key: the channel then uses the system default. Passing the
    // string 'default' makes expo-notifications hunt for a bundled raw
    // resource named "default", fail, and log an error on every single call.
  });
  return Notifications.getNotificationChannelAsync(CHANNEL_ID);
}

/**
 * Asks for permission if we do not already have it.
 *
 * Deliberately does *not* gate on `expo-device`'s `isDevice`. That check belongs
 * to the push-token flow (a simulator cannot receive remote pushes); locally
 * scheduled notifications work fine on emulators. Gating on it here meant every
 * reminder was silently dropped whenever the app ran on an emulator.
 */
export async function requestPermission(): Promise<boolean> {
  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.granted;
}

/**
 * Cancels only the notifications we tagged with `kind`, leaving the other kinds
 * alone. Cancelling everything would wipe per-class pings on every app open.
 */
async function cancelKind(kind: Kind) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((req) => (req.content.data as Payload | undefined)?.kind === kind)
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier)),
  );
}

/** Copy that changes with the day's shape, so the nudge never reads canned. */
function reminderCopy(todayCount: number, backlog: number) {
  if (todayCount === 0 && backlog === 0) {
    return { title: 'Nothing to log', body: 'No classes today. Enjoy the gap.' };
  }
  if (todayCount === 0) {
    return {
      title: `${backlog} class${backlog === 1 ? '' : 'es'} still unmarked`,
      body: 'No classes today, but earlier ones are waiting on you.',
    };
  }
  const backlogTail = backlog > 0 ? ` (plus ${backlog} from earlier)` : '';
  if (todayCount === 1) {
    return {
      title: 'How did today go?',
      body: `You had 1 class${backlogTail}. Present, absent, or cancelled?`,
    };
  }
  return {
    title: 'How did today go?',
    body: `You had ${todayCount} classes${backlogTail}. Takes 10 seconds to log them.`,
  };
}

/**
 * Schedules one notification at an absolute time.
 *
 * `channelId` belongs on the *trigger*, not the content — an earlier version set
 * it in both places, and the copy on `content` was silently ignored.
 */
function scheduleAt(
  identifier: string,
  fireAt: Date,
  title: string,
  body: string,
  data: Payload,
) {
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, data },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

/**
 * Rebuilds the reminder schedule from scratch.
 *
 * One notification per day for the next two weeks rather than a single
 * repeating daily trigger, because the copy has to reflect that specific day's
 * class count — and because "skip empty days" is only expressible per day. The
 * app re-arms this every time the Today screen renders, so the window keeps
 * sliding forward and never runs dry.
 */
export function rescheduleReminders(
  settings: Settings,
  input: ScheduleInput,
  backlog: number,
): Promise<number> {
  return serialize(async () => {
    if (!settings.reminderEnabled) {
      await cancelKind('daily');
      return 0;
    }

    const granted = await requestPermission();
    if (!granted) return 0;

    const now = new Date();
    const wanted = new Map<string, { fireAt: Date; title: string; body: string; date: string }>();

    for (let i = 0; i < HORIZON_DAYS; i++) {
      const day = addDays(now, i);
      const fireAt = combineDateTime(day, settings.reminderTime);

      // Today's slot may already have passed.
      if (fireAt.getTime() <= now.getTime() + 5000) continue;

      const dayClasses = classesOn(day, input);
      // Backlog only justifies a ping on the first day; after that it is stale.
      const dayBacklog = i === 0 ? backlog : 0;
      if (settings.reminderSkipEmptyDays && dayClasses.length === 0 && dayBacklog === 0) continue;

      const date = dateKey(day);
      const copy = reminderCopy(dayClasses.length, dayBacklog);
      wanted.set(dailyId(date), { fireAt, title: copy.title, body: copy.body, date });
    }

    // Drop dailies that have rolled out of the window or whose day no longer
    // qualifies. Anything still wanted is left alone here and simply rewritten
    // below — same identifier, so the alarm is replaced rather than duplicated.
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((req) => (req.content.data as Payload | undefined)?.kind === 'daily')
        .filter((req) => !wanted.has(req.identifier))
        .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier)),
    );

    for (const [id, spec] of wanted) {
      await scheduleAt(id, spec.fireAt, spec.title, spec.body, {
        kind: 'daily',
        fireAt: spec.fireAt.getTime(),
        date: spec.date,
      });
    }

    return wanted.size;
  });
}

/** One-off "your next class starts soon" ping, armed from the Today screen. */
export async function pingBeforeClass(
  next: ClassInstance,
  minutesBefore = 10,
): Promise<{ ok: boolean; message: string }> {
  const granted = await requestPermission();
  if (!granted) {
    return { ok: false, message: 'Notifications are turned off for this app.' };
  }

  const fireAt = new Date(next.start.getTime() - minutesBefore * 60 * 1000);
  if (fireAt.getTime() <= Date.now()) {
    return { ok: false, message: 'That class starts too soon to set a reminder.' };
  }

  // Only one class ping at a time. The fixed identifier makes that automatic —
  // re-arming overwrites the same alarm instead of stacking a second one.
  await cancelKind('class-ping');

  await scheduleAt(
    PING_ID,
    fireAt,
    `${next.course.code} in ${minutesBefore} minutes`,
    [next.meeting.room || next.course.room, next.course.name].filter(Boolean).join(' · '),
    { kind: 'class-ping', fireAt: fireAt.getTime() },
  );

  return { ok: true, message: `You'll be nudged ${minutesBefore} minutes before.` };
}

/* ----------------------------------------------------------- diagnostics -- */

export type NotificationHealth = {
  /** OS-level permission for this app. */
  granted: boolean;
  /** False once the user has permanently denied — only system settings can fix it. */
  canAskAgain: boolean;
  /**
   * Android lets the user silence one channel while leaving the app allowed.
   * When that happens nothing ever appears and no API call fails, which is the
   * single most confusing way for reminders to "not work".
   */
  channelBlocked: boolean;
  /** How many evening nudges are currently armed in the rolling window. */
  pendingDaily: number;
  pendingPing: number;
  nextFireAt: Date | null;
};

export async function notificationHealth(): Promise<NotificationHealth> {
  const perms = await Notifications.getPermissionsAsync();

  let channelBlocked = false;
  if (Platform.OS === 'android') {
    const channel = await ensureAndroidChannel();
    // Importance is frozen after creation, so a user-silenced channel stays
    // silenced until they change it back themselves.
    channelBlocked = channel != null && channel.importance === Notifications.AndroidImportance.NONE;
  }

  const all = await Notifications.getAllScheduledNotificationsAsync();
  const daily: number[] = [];
  let pendingPing = 0;

  for (const req of all) {
    const data = req.content.data as Payload | undefined;
    if (data?.kind === 'daily') {
      daily.push(data.fireAt ?? 0);
    } else if (data?.kind === 'class-ping') {
      pendingPing++;
    }
  }

  const upcoming = daily.filter((t) => t > Date.now()).sort((a, b) => a - b);

  return {
    granted: perms.granted,
    canAskAgain: perms.canAskAgain,
    channelBlocked,
    pendingDaily: daily.length,
    pendingPing,
    nextFireAt: upcoming.length > 0 ? new Date(upcoming[0]) : null,
  };
}

/**
 * Fires a notification a few seconds out. The delay is deliberate: it gives the
 * user time to leave the app, which is the only way to prove delivery works
 * when the OS is the thing swallowing them.
 */
export async function sendTestNotification(
  seconds = 5,
): Promise<{ ok: boolean; message: string }> {
  const granted = await requestPermission();
  if (!granted) {
    return {
      ok: false,
      message: 'Android has not granted this app permission to post notifications.',
    };
  }

  await cancelKind('test');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminders are working',
      body: 'This is what your evening nudge will look like.',
      data: { kind: 'test' satisfies Kind } satisfies Payload,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });

  return {
    ok: true,
    message: `Sent. Lock your phone now — it arrives in ${seconds} seconds.`,
  };
}
