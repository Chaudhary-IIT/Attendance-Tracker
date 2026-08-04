import React from 'react';
import { AppState } from 'react-native';

/**
 * A Date that re-renders on an interval and immediately on foreground, so
 * countdowns stay honest after the phone has been asleep.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [intervalMs]);

  return now;
}

/** "in 2h 15m" / "in 4 min" / "started 12 min ago". */
export function formatCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const past = diffMs < 0;
  const total = Math.floor(Math.abs(diffMs) / 1000);

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  let body: string;
  if (days > 0) body = `${days}d ${hours}h`;
  else if (hours > 0) body = `${hours}h ${mins}m`;
  else if (mins > 0) body = `${mins}m ${String(secs).padStart(2, '0')}s`;
  else body = `${secs}s`;

  return past ? `${body} ago` : `in ${body}`;
}

/** Compact form without seconds, for dense rows. */
export function formatCountdownShort(target: Date, now: Date): string {
  const total = Math.floor(Math.abs(target.getTime() - now.getTime()) / 60000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}
