/**
 * Cloudflare Pages Function (offre gratuite) : aperçu des liens partagés.
 *
 * - Pour toutes les pages HTML : rend absolues les adresses og:image / og:url (exigé par WhatsApp et Facebook).
 * - Pour un lien d'invitation /i/:token ouvert par un robot d'aperçu (WhatsApp, Facebook, Telegram…) :
 *   personnalise le titre (« Invitation pour M. Paul Ngo »). L'appel à get_invitation se fait avec
 *   p_track = false, pour que l'aperçu ne marque PAS l'invitation comme « ouverte ».
 *   Les vrais visiteurs ne déclenchent aucun appel : leur page n'est pas ralentie.
 *
 * Variables lues : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (les mêmes que le build, à déclarer
 * dans Cloudflare Pages > Settings > Variables pour Production et Preview).
 * Routes concernées : public/_routes.json. Ne tourne pas avec `npm run dev`.
 */
import { invitationName } from '../src/lib/people';
import { fmtLongDate } from '../src/lib/format';
import type { Lang, PublicInvitation } from '../src/lib/types';

interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}
interface Ctx {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}
interface RewriterElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  setInnerContent(text: string): void;
}
declare class HTMLRewriter {
  on(selector: string, handler: { element(el: RewriterElement): void }): HTMLRewriter;
  transform(res: Response): Response;
}

const BOTS = /whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|skypeuripreview|applebot|googlebot|bingbot|pinterest|redditbot|embedly|vkshare|viber|snapchat/i;

async function personalize(env: Env, token: string, meta: Record<string, string>) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const r = await fetch(`${url}/rest/v1/rpc/get_invitation`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_track: false }),
  });
  if (!r.ok) return null;
  const d = (await r.json()) as PublicInvitation | null;
  if (!d) return null;
  const lang: Lang = d.invitation.language === 'en' ? 'en' : 'fr';
  const who = invitationName({ ...d.invitation, guests: d.guests }, lang);
  const couple = d.settings.couple_names;
  const date = fmtLongDate(d.settings.wedding_date, lang);
  const title = lang === 'en' ? `Invitation for ${who} · ${couple}` : `Invitation pour ${who} · ${couple}`;
  const description =
    lang === 'en'
      ? `${couple} are delighted to invite you to their wedding${date ? ` on ${date}` : ''}. Open your invitation to confirm your attendance.`
      : `${couple} ont la joie de vous inviter à leur mariage${date ? ` le ${date}` : ''}. Ouvrez votre invitation pour confirmer votre présence.`;
  Object.assign(meta, {
    'og:title': title,
    'twitter:title': title,
    'og:description': description,
    'twitter:description': description,
    description,
    'og:locale': lang === 'en' ? 'en_GB' : 'fr_FR',
  });
  return title;
}

export const onRequest = async ({ request, env, next }: Ctx) => {
  const res = await next();
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;

  const url = new URL(request.url);
  const image = `${url.origin}/og-image.jpg`;
  const meta: Record<string, string> = { 'og:url': url.origin + url.pathname, 'og:image': image, 'twitter:image': image };
  let title: string | null = null;

  const m = url.pathname.match(/^\/i\/([a-f0-9]{16,})\/?$/i);
  if (m && BOTS.test(request.headers.get('user-agent') || '')) {
    try {
      title = await personalize(env, m[1], meta);
    } catch {
      // En cas d'échec, on garde l'aperçu générique.
    }
  }

  let rw = new HTMLRewriter().on('meta', {
    element(el) {
      const k = el.getAttribute('property') || el.getAttribute('name');
      if (k && k in meta) el.setAttribute('content', meta[k]);
    },
  });
  if (title) {
    const t = title;
    rw = rw.on('title', { element: (el) => el.setInnerContent(t) });
  }
  return rw.transform(res);
};
