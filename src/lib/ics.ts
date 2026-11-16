import type { EventItem, Lang } from './types';
import { eventNotes, eventTitle } from './format';

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const endOf = (e: EventItem) => e.ends_at || new Date(new Date(e.starts_at).getTime() + 2 * 3600_000).toISOString();
/** Consignes + lien de visioconférence éventuel. */
const details = (e: EventItem, lang: Lang) => [eventNotes(e, lang), e.stream_url].filter(Boolean).join('\n\n');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export function buildIcs(events: EventItem[], lang: Lang, couple: string) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//faire-part-mariage//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@faire-part-mariage`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(e.starts_at)}`,
      `DTEND:${stamp(endOf(e))}`,
      `SUMMARY:${esc(`${eventTitle(e, lang)} – ${couple}`)}`,
      `LOCATION:${esc([e.venue_name, e.address].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${esc(details(e, lang))}`,
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(eventTitle(e, lang))}`, 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(events: EventItem[], lang: Lang, couple: string) {
  const blob = new Blob([buildIcs(events, lang, couple)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mariage.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function googleCalendarUrl(e: EventItem, lang: Lang, couple: string) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${eventTitle(e, lang)} – ${couple}`,
    dates: `${stamp(e.starts_at)}/${stamp(endOf(e))}`,
    details: details(e, lang),
    location: [e.venue_name, e.address].filter(Boolean).join(', '),
    ctz: 'Africa/Douala',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
