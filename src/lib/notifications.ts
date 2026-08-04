import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ClassInstance, Settings } from '../types';
import { addDays, classesOn, combineDateTime, dateKey, type ScheduleInput } from './schedule';

const CHANNEL_ID = 'attendance-reminders';

/** How many days ahead we pre-schedule. iOS caps pending notifications at 64. */
const HORIZON_DAYS = 14;

/** Tag on every notification we create, so we can cancel selectively. */
type Kind = 'daily' | 'class-ping';

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
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Attendance reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#6D5BFF',
    sound: 'default',
  });
}

/**
 * Asks for permission if we do not already have it. Returns whether we may
 * post notifications. On a simulator this always returns false.
 */
export async function requestPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Cancels only the notifications we tagged with `kind`, leaving the other kind
 * alone. Cancelling everything would wipe per-class pings on every app open.
 */
async function cancelKind(kind: Kind) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((req) => (req.content.data as { kind?: Kind } | undefined)?.kind === kind)
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
 * Rebuilds the reminder schedule from scratch.
 *
 * One notification per day for the next two weeks rather than a single
 * repeating daily trigger, because the copy has to reflect that specific day's
 * class count — and because "skip empty days" is only expressible per day. The
 * app re-arms this every time the Today screen renders, so the window keeps
 * sliding forward and never runs dry.
 */
export async function rescheduleReminders(
  settings: Settings,
  input: ScheduleInput,
  backlog: number,
): Promise<number> {
  await cancelKind('daily');
  if (!settings.reminderEnabled) return 0;

  const granted = await requestPermission();
  if (!granted) return 0;

  const now = new Date();
  let scheduled = 0;

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = addDays(now, i);
    const fireAt = combineDateTime(day, settings.reminderTime);

    // Today's slot may already have passed.
    if (fireAt.getTime() <= now.getTime() + 5000) continue;

    const dayClasses = classesOn(day, input);
    // Backlog only justifies a ping on the first day; after that it is stale.
    const dayBacklog = i === 0 ? backlog : 0;
    if (settings.reminderSkipEmptyDays && dayClasses.length === 0 && dayBacklog === 0) continue;

    const copy = reminderCopy(dayClasses.length, dayBacklog);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        data: { kind: 'daily' satisfies Kind, date: dateKey(day) },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
    scheduled++;
  }

  return scheduled;
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

  // Only one class ping at a time — arming a new one replaces the old.
  await cancelKind('class-ping');

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${next.course.code} in ${minutesBefore} minutes`,
      body: [next.course.name, next.meeting.room || next.course.room].filter(Boolean).join(' · '),
      data: { kind: 'class-ping' satisfies Kind },
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });

  return { ok: true, message: `You'll be nudged ${minutesBefore} minutes before.` };
}
