import { get, set } from 'idb-keyval';
import { supabase } from './supabase';
import type { Civility } from './types';

export interface CachedGuest {
  id: string;
  full_name: string;
  civility?: Civility | null;
  is_child: boolean;
  table_label: string | null;
  checked_in_at: string | null;
  invitation_id: string;
}
export interface CachedInvitation {
  id: string;
  token: string;
  household_name: string | null;
  guests: CachedGuest[];
}
interface QueueItem {
  ids: string[];
  at: string;
}

const CACHE = 'checkin-cache';
const QUEUE = 'checkin-queue';

const readQueue = async () => ((await get(QUEUE)) as QueueItem[] | undefined) || [];

/** Télécharge toute la liste des invités pour pouvoir pointer sans réseau. */
export async function refreshCache(): Promise<CachedInvitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, token, household_name, guests(id, full_name, civility, is_child, table_label, checked_in_at, invitation_id)')
    .order('household_name');
  if (error) throw error;
  const list = (data || []) as CachedInvitation[];
  // Ré-applique les pointages pas encore envoyés pour ne pas les perdre à l'affichage.
  const queue = await readQueue();
  for (const q of queue) for (const inv of list) for (const g of inv.guests) if (q.ids.includes(g.id) && !g.checked_in_at) g.checked_in_at = q.at;
  await set(CACHE, list);
  return list;
}

export async function readCache(): Promise<CachedInvitation[]> {
  return ((await get(CACHE)) as CachedInvitation[] | undefined) || [];
}

export async function pendingCount() {
  return (await readQueue()).reduce((n, q) => n + q.ids.length, 0);
}

/** Pointe des invités : envoi immédiat si possible, sinon mise en file d'attente locale. */
export async function checkIn(ids: string[]): Promise<'sent' | 'queued'> {
  const at = new Date().toISOString();
  const cache = await readCache();
  for (const inv of cache) for (const g of inv.guests) if (ids.includes(g.id) && !g.checked_in_at) g.checked_in_at = at;
  await set(CACHE, cache);
  if (navigator.onLine) {
    const { error } = await supabase.rpc('check_in_guests', { p_guest_ids: ids, p_at: at });
    if (!error) return 'sent';
  }
  const queue = await readQueue();
  queue.push({ ids, at });
  await set(QUEUE, queue);
  return 'queued';
}

/** Envoie les pointages en attente dès que le réseau revient. */
export async function flushQueue() {
  const queue = await readQueue();
  const rest: QueueItem[] = [];
  for (const q of queue) {
    const { error } = await supabase.rpc('check_in_guests', { p_guest_ids: q.ids, p_at: q.at });
    if (error) rest.push(q);
  }
  await set(QUEUE, rest);
  return queue.length - rest.length;
}

export function extractToken(text: string) {
  const m = text.match(/\/i\/([a-f0-9]{16,})/i);
  if (m) return m[1];
  const raw = text.trim();
  return /^[a-f0-9]{16,}$/i.test(raw) ? raw : null;
}
