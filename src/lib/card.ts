/**
 * Carte d'invitation imprimable, dessinée sur un canvas puis exportée en image (JPEG) ou en PDF.
 * Format A5 portrait (148 × 210 mm), le format de faire-part le plus courant chez les imprimeurs,
 * à 300 dpi. Aucune dépendance : le PDF est écrit à la main (une page, une image JPEG).
 * Ce module est chargé à la demande (import dynamique) pour ne pas alourdir l'invitation.
 */
import i18n from '../i18n';
import { eventTitle, fmtLongDate, fmtTime } from './format';
import { DEFAULT_THEME } from './theme';
import type { EventItem, Lang, TemplateId, Theme } from './types';

export const CARD_MM = { w: 148, h: 210 };
const DPI = 300;
const W = Math.round((CARD_MM.w / 25.4) * DPI); // 1748
const H = Math.round((CARD_MM.h / 25.4) * DPI); // 2480

export interface CardData {
  lang: Lang;
  template: TemplateId;
  theme: Theme | null;
  couple: string;
  weddingDate: string | null;
  rsvpDeadline: string | null;
  /** « M. Paul Ngo et Mme Marie Ngo » ou le nom affiché de l'invitation. */
  invitees: string;
  events: EventItem[];
  url: string;
}

interface Palette {
  paper: string;
  ink: string;
  accent: string;
  soft: string;
}

const DISPLAY = '"Bodoni Moda", "Didot", "Bodoni 72", Georgia, serif';
const BODY = '"Jost", "Avenir Next", "Segoe UI", system-ui, sans-serif';

function palette(tpl: TemplateId, t: Theme): Palette {
  switch (tpl) {
    case 'nuit':
      return { paper: t.marine, ink: t.ivory, accent: t.gold, soft: t.sand };
    case 'jardin':
      return { paper: t.ivory, ink: t.marine, accent: '#6f8560', soft: t.marine };
    case 'ivoire':
      return { paper: '#fffdf9', ink: t.navy, accent: t.gold, soft: t.marine };
    default:
      return { paper: t.ivory, ink: t.navy, accent: t.gold, soft: t.marine };
  }
}

async function loadFonts() {
  if (!document.fonts?.load) return;
  await Promise.all(
    ['500 100px "Bodoni Moda"', 'italic 400 100px "Bodoni Moda"', '400 40px "Jost"', '500 40px "Jost"'].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
}

/** Rectangle arrondi (repli en rectangle simple sur les navigateurs sans roundRect, ex. iOS 15). */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Découpe un texte en lignes qui tiennent dans maxW. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Texte espacé (petites capitales) centré. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = Array.from(text);
  const total = chars.reduce((n, c) => n + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = 'center';
}

/** Le nœud, motif du mariage (même dessin que le composant Bow). */
function bow(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, color: string, knot: string) {
  const s = width / 50;
  ctx.save();
  ctx.translate(cx - 25 * s, cy - 15 * s);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.fill(new Path2D('M25 15 L2 3 Q0 15 2 27 Z'));
  ctx.fill(new Path2D('M25 15 L48 3 Q50 15 48 27 Z'));
  ctx.fillStyle = knot;
  roundRect(ctx, 21, 9, 8, 12, 2);
  ctx.fill();
  ctx.restore();
}

function leaves(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, color: string, flip = false) {
  const s = width / 200;
  ctx.save();
  ctx.translate(cx - 100 * s, cy - 30 * s);
  if (flip) {
    ctx.translate(0, 60 * s);
    ctx.scale(1, -1);
  }
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke(new Path2D('M5 50 Q100 0 195 50'));
  ctx.globalAlpha = 0.7;
  [20, 45, 70, 95, 120, 145, 170].forEach((x, i) => {
    const y = i % 2 ? 30 : 22;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((i % 2 ? 30 : -30) * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

function stars(ctx: CanvasRenderingContext2D, colors: string[]) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.35 + rnd() * 0.5;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 1.5 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function frame(ctx: CanvasRenderingContext2D, tpl: TemplateId, p: Palette) {
  ctx.strokeStyle = p.accent;
  if (tpl === 'ivoire') {
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 3;
    ctx.strokeRect(90, 90, W - 180, H - 180);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.lineWidth = tpl === 'jardin' ? 3 : 5;
  ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(100, 100, W - 200, H - 200);
  ctx.globalAlpha = 1;
  // Petits losanges aux coins du cadre intérieur
  for (const [x, y] of [[100, 100], [W - 100, 100], [100, H - 100], [W - 100, H - 100]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = p.accent;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
  }
}

function divider(ctx: CanvasRenderingContext2D, y: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, y);
  ctx.lineTo(W / 2 - 30, y);
  ctx.moveTo(W / 2 + 30, y);
  ctx.lineTo(W / 2 + 220, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
}

/**
 * Bloc central. Dessine (draw = true) ou mesure seulement, à l'échelle k.
 * Renvoie la hauteur occupée, pour ajuster l'échelle si le contenu est long.
 */
function body(ctx: CanvasRenderingContext2D, d: CardData, p: Palette, k: number, top: number, draw: boolean) {
  const t = i18n.getFixedT(d.lang);
  const maxW = W - 420;
  let y = top;
  const text = (s: string, font: string, color: string, lh: number, opts: { spacing?: number; max?: number } = {}) => {
    ctx.font = font;
    ctx.fillStyle = color;
    const lines = opts.spacing ? [s] : wrap(ctx, s, opts.max ?? maxW);
    for (const l of lines) {
      y += lh;
      if (draw) {
        if (opts.spacing) spaced(ctx, l, W / 2, y, opts.spacing);
        else ctx.fillText(l, W / 2, y);
      }
    }
  };
  const gap = (n: number) => (y += n * k);

  // Destinataires
  text(t('envelope.for').toUpperCase(), `500 ${34 * k}px ${BODY}`, p.accent, 34 * k, { spacing: 8 * k });
  gap(18);
  text(d.invitees, `italic 400 ${62 * k}px ${DISPLAY}`, p.ink, 72 * k, { max: maxW - 60 });
  gap(46);
  if (draw) bow(ctx, W / 2, y + 30 * k, 150 * k, p.ink, p.accent);
  gap(84);

  // Les mariés
  const [a, b] = d.couple.split('&').map((s) => s.trim());
  const style = d.template === 'ivoire' ? 'italic ' : '';
  ctx.font = `${style}500 ${190 * k}px ${DISPLAY}`;
  const widest = Math.max(ctx.measureText(a).width, b ? ctx.measureText(b).width : 0);
  const fit = Math.min(1, maxW / widest);
  text(a, `${style}500 ${190 * k * fit}px ${DISPLAY}`, p.ink, 175 * k * fit, { max: 99999 });
  if (b) {
    text('&', `italic 400 ${110 * k}px ${DISPLAY}`, p.accent, 125 * k);
    text(b, `${style}500 ${190 * k * fit}px ${DISPLAY}`, p.ink, 175 * k * fit, { max: 99999 });
  }
  gap(60);
  text(t('hero.invite'), `400 ${44 * k}px ${BODY}`, p.ink, 56 * k);
  gap(24);
  const date = fmtLongDate(d.weddingDate, d.lang);
  if (date) text(date.charAt(0).toUpperCase() + date.slice(1), `500 ${66 * k}px ${DISPLAY}`, p.ink, 78 * k);
  gap(56);
  if (draw) divider(ctx, y, p.accent);
  gap(40);

  // Programme
  for (const e of d.events) {
    gap(26);
    ctx.font = `600 ${50 * k}px ${DISPLAY}`;
    const time = fmtTime(e.starts_at, d.lang);
    const title = eventTitle(e, d.lang);
    const tw = ctx.measureText(`${time}   `).width;
    ctx.font = `500 ${50 * k}px ${DISPLAY}`;
    const titleW = ctx.measureText(title).width;
    if (tw + titleW > maxW) {
      // Titre long : l'heure sur sa ligne, le titre en dessous.
      text(time, `600 ${50 * k}px ${DISPLAY}`, p.accent, 58 * k);
      text(title, `500 ${50 * k}px ${DISPLAY}`, p.ink, 60 * k);
    } else {
      y += 58 * k;
      if (draw) {
        const x0 = W / 2 - (tw + titleW) / 2;
        ctx.textAlign = 'left';
        ctx.font = `600 ${50 * k}px ${DISPLAY}`;
        ctx.fillStyle = p.accent;
        ctx.fillText(time, x0, y);
        ctx.font = `500 ${50 * k}px ${DISPLAY}`;
        ctx.fillStyle = p.ink;
        ctx.fillText(title, x0 + tw, y);
        ctx.textAlign = 'center';
      }
    }
    const place = [e.venue_name, e.address].filter(Boolean).join(' · ');
    if (place) {
      ctx.globalAlpha = 0.8;
      text(place, `400 ${36 * k}px ${BODY}`, p.ink, 48 * k);
      ctx.globalAlpha = 1;
    }
  }
  return y - top;
}

/** Dessine la carte complète. `qr` : canvas du QR code (lien personnel de l'invitation). */
export async function renderCard(d: CardData, qr: HTMLCanvasElement) {
  await loadFonts();
  const theme = { ...DEFAULT_THEME, ...(d.theme || {}) };
  const p = palette(d.template, theme);
  const t = i18n.getFixedT(d.lang);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Fond et décor du modèle
  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);
  if (d.template === 'nuit') stars(ctx, [theme.gold, theme.sand, theme.ivory]);
  frame(ctx, d.template, p);
  if (d.template === 'jardin') {
    leaves(ctx, W / 2, 205, 520, p.accent);
    leaves(ctx, W / 2, H - 205, 520, p.accent, true);
  }

  // Bas de carte : QR code + consignes (hauteur fixe)
  const qrSize = 330;
  const footerTop = H - 350 - qrSize - (d.template === 'jardin' ? 100 : 0);
  const qrX = W / 2 - qrSize / 2;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 22, footerTop - 22, qrSize + 44, qrSize + 44, 18);
  ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, qrX, footerTop, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = p.ink;
  ctx.font = `500 34px ${BODY}`;
  ctx.fillText(t('card.qr'), W / 2, footerTop + qrSize + 80);
  if (d.rsvpDeadline) {
    ctx.globalAlpha = 0.8;
    ctx.font = `400 32px ${BODY}`;
    ctx.fillText(t('rsvp.deadline', { date: fmtLongDate(d.rsvpDeadline, d.lang) }), W / 2, footerTop + qrSize + 128);
    ctx.globalAlpha = 1;
  }

  // Bloc central : on réduit l'échelle jusqu'à ce qu'il tienne, puis on le centre verticalement.
  const areaTop = d.template === 'jardin' ? 290 : 230;
  const areaH = footerTop - 70 - areaTop;
  let k = 1;
  let h = body(ctx, d, p, k, 0, false);
  while (h > areaH && k > 0.55) {
    k -= 0.05;
    h = body(ctx, d, p, k, 0, false);
  }
  body(ctx, d, p, k, areaTop + Math.max(0, (areaH - h) / 2), true);
  return canvas;
}

const toJpeg = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('export'))), 'image/jpeg', 0.92));

export const cardToImage = toJpeg;

/** PDF d'une page au format de la carte, contenant l'image JPEG (filtre DCTDecode, sans réencodage). */
export async function cardToPdf(canvas: HTMLCanvasElement) {
  const jpeg = new Uint8Array(await (await toJpeg(canvas)).arrayBuffer());
  const pw = ((CARD_MM.w / 25.4) * 72).toFixed(2);
  const ph = ((CARD_MM.h / 25.4) * 72).toFixed(2);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (d: string | Uint8Array) => {
    const b = typeof d === 'string' ? enc.encode(d) : d;
    parts.push(b);
    len += b.length;
  };
  const obj = (n: number, ...body: (string | Uint8Array)[]) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`);
    body.forEach(push);
    push('\nendobj\n');
  };
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream',
  );
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push(
    `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
      .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** Enregistre un fichier : partage natif sur téléphone pour une image (→ Photos), sinon téléchargement. */
export async function saveFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (blob.type.startsWith('image/') && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
