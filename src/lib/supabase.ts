import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-anon-key');

/** Traduit les erreurs de la base en messages compréhensibles. */
export function friendlyError(err: unknown): string {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : String(err);
  if (msg.includes('QUOTA_EXCEEDED')) return 'Votre quota d’invités est atteint. Demandez à l’administrateur de l’augmenter.';
  if (msg.includes('FORBIDDEN')) return 'Votre compte n’a pas le droit de faire cette action.';
  if (msg.includes('Invalid login')) return 'Adresse e-mail ou mot de passe incorrect.';
  if (msg.includes('Failed to fetch')) return 'Pas de connexion internet. Réessayez quand le réseau revient.';
  return msg;
}
