import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DAY_NAMES, courseMeetings, formatTime, toMinutes } from './schedule';
import { paletteAt } from '../theme';
import type { AttendanceMark, Course, OneOffClass, Settings, Slot } from '../types';
import { statsFor } from './schedule';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type GridCell = { course: Course; label?: string; room: string };

/**
 * Builds the printable timetable: a light-theme HTML page with the weekly grid
 * plus an attendance summary. Rendered to PDF by expo-print.
 */
export function buildTimetableHtml(
  courses: Course[],
  slots: Slot[],
  marks: Record<string, AttendanceMark>,
  settings: Settings,
): string {
  const active = courses.filter((c) => !c.archived);

  // Collect every distinct period across all enrolled courses.
  const periodSet = new Map<string, { start: string; end: string }>();
  const dayset = new Set<number>();
  const grid = new Map<string, GridCell[]>();

  for (const course of active) {
    for (const mt of courseMeetings(course, slots)) {
      const pk = `${mt.start}-${mt.end}`;
      periodSet.set(pk, { start: mt.start, end: mt.end });
      dayset.add(mt.day);
      const key = `${mt.day}|${pk}`;
      const cell = { course, label: mt.label, room: mt.room || course.room };
      grid.set(key, [...(grid.get(key) ?? []), cell]);
    }
  }

  const periods = [...periodSet.values()].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const days = [...dayset].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));

  const headCells = days.map((d) => `<th>${DAY_NAMES[d]}</th>`).join('');

  const rows = periods
    .map((p) => {
      const pk = `${p.start}-${p.end}`;
      const cells = days
        .map((d) => {
          const items = grid.get(`${d}|${pk}`) ?? [];
          if (items.length === 0) return '<td class="empty"></td>';
          const inner = items
            .map((it) => {
              const c = paletteAt(it.course.colorIndex).base;
              return `<div class="cell" style="border-left:3px solid ${c}">
                <div class="code" style="color:${c}">${escapeHtml(it.course.code)}${
                  it.label ? ` · ${escapeHtml(it.label)}` : ''
                }</div>
                <div class="name">${escapeHtml(it.course.name)}</div>
                ${it.room ? `<div class="room">${escapeHtml(it.room)}</div>` : ''}
              </div>`;
            })
            .join('');
          return `<td>${inner}</td>`;
        })
        .join('');
      return `<tr><th class="time">${formatTime(p.start)}<br><span>${formatTime(p.end)}</span></th>${cells}</tr>`;
    })
    .join('');

  const summaryRows = active
    .map((course) => {
      const s = statsFor(course, marks, settings);
      const pct = s.percent == null ? '—' : `${s.percent.toFixed(1)}%`;
      const ok = s.percent == null || s.percent >= s.threshold;
      const slot = course.slotKey ? course.slotKey : '—';
      return `<tr>
        <td><b>${escapeHtml(course.code)}</b><br><span class="dim">${escapeHtml(course.name)}</span></td>
        <td>${escapeHtml(slot)}</td>
        <td>${escapeHtml(course.room || '—')}</td>
        <td>${s.present}</td>
        <td>${s.absent}</td>
        <td>${s.cancelled}</td>
        <td class="${ok ? 'ok' : 'bad'}"><b>${pct}</b></td>
      </tr>`;
    })
    .join('');

  const generated = new Date().toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color:#14141E; margin:28px; }
  h1 { font-size:24px; margin:0 0 4px; letter-spacing:-0.5px; }
  .sub { color:#6B6B80; font-size:12px; margin-bottom:22px; }
  h2 { font-size:15px; margin:26px 0 10px; text-transform:uppercase; letter-spacing:1px; color:#6B6B80; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th, td { border:1px solid #E2E2EA; padding:6px; vertical-align:top; text-align:left; }
  thead th { background:#F4F4F8; font-size:11px; text-transform:uppercase; letter-spacing:0.6px; }
  th.time { width:78px; background:#FAFAFC; font-weight:600; white-space:nowrap; }
  th.time span { color:#9A9AAE; font-weight:400; }
  td.empty { background:#FCFCFD; }
  .cell { padding:4px 6px; margin-bottom:3px; background:#FAFAFC; border-radius:4px; }
  .code { font-weight:700; font-size:10px; }
  .name { font-size:10px; line-height:1.3; margin-top:1px; }
  .room { font-size:9px; color:#8A8A9E; margin-top:1px; }
  .dim { color:#8A8A9E; font-size:10px; }
  .ok { color:#0F9D58; }
  .bad { color:#DB4437; }
</style></head><body>
  <h1>Weekly Timetable</h1>
  <div class="sub">${active.length} course${active.length === 1 ? '' : 's'} · target ${
    settings.minAttendance
  }% · generated ${escapeHtml(generated)}</div>

  ${
    periods.length
      ? `<table><thead><tr><th class="time">Time</th>${headCells}</tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="dim">No scheduled meetings yet.</p>'
  }

  <h2>Attendance summary</h2>
  <table>
    <thead><tr><th>Course</th><th>Slot</th><th>Room</th><th>Present</th><th>Absent</th><th>Cancelled</th><th>%</th></tr></thead>
    <tbody>${summaryRows || '<tr><td colspan="7" class="dim">No courses.</td></tr>'}</tbody>
  </table>
</body></html>`;
}

/** Renders the timetable to a PDF and opens the system share sheet. */
export async function exportTimetablePdf(
  courses: Course[],
  slots: Slot[],
  marks: Record<string, AttendanceMark>,
  settings: Settings,
): Promise<{ ok: boolean; message: string }> {
  try {
    const html = buildTimetableHtml(courses, slots, marks, settings);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: true, message: `Saved to ${uri}` };
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save or share timetable',
      UTI: 'com.adobe.pdf',
    });
    return { ok: true, message: 'Timetable exported.' };
  } catch (err) {
    return { ok: false, message: `Export failed: ${String(err)}` };
  }
}

/** Full data backup as JSON — courses, slots, marks and settings. */
export async function exportBackupJson(data: {
  courses: Course[];
  slots: Slot[];
  marks: Record<string, AttendanceMark>;
  settings: Settings;
  oneOffs: OneOffClass[];
}): Promise<{ ok: boolean; message: string }> {
  try {
    const payload = JSON.stringify({ version: 1, exportedAt: Date.now(), ...data }, null, 2);
    const file = new FileSystem.File(
      FileSystem.Paths.cache,
      `attendance-backup-${Date.now()}.json`,
    );
    file.create({ overwrite: true });
    file.write(payload);

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: true, message: `Saved to ${file.uri}` };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save backup',
      UTI: 'public.json',
    });
    return { ok: true, message: 'Backup exported.' };
  } catch (err) {
    return { ok: false, message: `Backup failed: ${String(err)}` };
  }
}
