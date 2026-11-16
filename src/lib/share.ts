import i18n from '../i18n';
import { peopleLabel } from './people';
import type { Civility, Lang } from './types';

type Person = { full_name: string; civility?: Civility | null };

/** Numéros camerounais : « 6 99 12 34 56 » → « 237699123456 ». */
export function normalizePhone(raw: string | null | undefined) {
  if (!raw) return '';
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && /^[26]/.test(d)) d = `237${d}`;
  return d;
}

export function invitationUrl(token: string) {
  return `${window.location.origin}/i/${token}`;
}

export function whatsappUrl(phone: string | null | undefined, text: string) {
  const n = normalizePhone(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Message d'invitation : nomme chaque personne et s'adresse à une ou plusieurs personnes selon le cas. */
export function invitationMessage(opts: { lang: Lang; guests: Person[]; couple: string; date: string; url: string }) {
  const { lang, guests, couple, date, url } = opts;
  return i18n.getFixedT(lang)('message.invite', { count: Math.max(1, guests.length), names: peopleLabel(guests, lang), couple, date, url });
}

export function fillTemplate(text: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), text);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
