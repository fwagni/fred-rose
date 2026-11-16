import type { Theme } from './types';

/** Couleurs relevées sur l'image d'inspiration du mariage. */
export const DEFAULT_THEME: Theme = {
  navy: '#121A33',
  marine: '#1E2A50',
  gold: '#A88B60',
  sand: '#D9C9A9',
  ivory: '#F4F2EE',
};

export const PRESETS: { name: string; theme: Theme }[] = [
  { name: 'Marine et or (Fredoly & Rose)', theme: DEFAULT_THEME },
  { name: 'Émeraude et champagne', theme: { navy: '#0F2A22', marine: '#1C4436', gold: '#B8995A', sand: '#E3D5B8', ivory: '#F6F3EC' } },
  { name: 'Bordeaux et rose poudré', theme: { navy: '#2B0F18', marine: '#4C1B2A', gold: '#B98A6A', sand: '#E9CFC6', ivory: '#FBF5F2' } },
  { name: 'Ardoise et argent', theme: { navy: '#1C2227', marine: '#33404A', gold: '#9AA5AE', sand: '#D7DCE0', ivory: '#F4F5F6' } },
];

export function applyTheme(theme: Theme | null | undefined) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const root = document.documentElement.style;
  root.setProperty('--navy', t.navy);
  root.setProperty('--marine', t.marine);
  root.setProperty('--gold', t.gold);
  root.setProperty('--sand', t.sand);
  root.setProperty('--ivory', t.ivory);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.navy);
}

/** Initiales du monogramme : « Fredoly & Rose » → « F&R ». */
export function monogram(coupleNames: string) {
  const parts = coupleNames.split(/&| et | and /i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return coupleNames.slice(0, 2).toUpperCase();
  return `${parts[0][0]}&${parts[1][0]}`.toUpperCase();
}
