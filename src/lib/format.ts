import type { EventItem, Lang } from './types';

export const TZ = 'Africa/Douala';
const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR');

export function fmtLongDate(iso: string | null | undefined, lang: Lang) {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00+01:00`) : new Date(iso);
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(d);
}

export function fmtTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined, lang: Lang = 'fr') {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
}

/** Valeur pour <input type="datetime-local"> exprimée à l'heure de Douala (UTC+1, sans heure d'été). */
export function toDoualaInput(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 16);
}

export function fromDoualaInput(local: string) {
  return local ? `${local}:00+01:00` : null;
}

export function eventTitle(e: EventItem, lang: Lang) {
  return (lang === 'en' && e.title_en) || e.title_fr;
}

export function eventNotes(e: EventItem, lang: Lang) {
  return (lang === 'en' && e.notes_en) || e.notes_fr || '';
}

/** « Jean, Marie et Paul » ou « Jean, Marie and Paul ». */
export function joinNames(names: string[], lang: Lang) {
  if (names.length <= 1) return names.join('');
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(', ')} ${lang === 'en' ? 'and' : 'et'} ${last}`;
}
