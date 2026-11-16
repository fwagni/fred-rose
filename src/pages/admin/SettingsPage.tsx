import { useEffect, useState, type FormEvent } from 'react';
import { supabase, friendlyError } from '../../lib/supabase';
import { useSettings } from '../../lib/useSettings';
import { applyTheme, DEFAULT_THEME, PRESETS } from '../../lib/theme';
import type { Settings, Theme } from '../../lib/types';

const COLOR_LABELS: { key: keyof Theme; label: string }[] = [
  { key: 'navy', label: 'Couleur profonde (fonds sombres)' },
  { key: 'marine', label: 'Couleur principale' },
  { key: 'gold', label: 'Accent doré' },
  { key: 'sand', label: 'Couleur douce' },
  { key: 'ivory', label: 'Fond clair' },
];

export default function SettingsPage() {
  const { settings, reload } = useSettings();
  const [form, setForm] = useState<Settings | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setTheme({ ...DEFAULT_THEME, ...(settings.theme || {}) });
    }
  }, [settings]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  if (!form) return <p className="muted">Chargement…</p>;
  const set = (k: keyof Settings, v: string) => setForm({ ...form, [k]: v || null });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('settings').update({ ...form, theme, updated_at: new Date().toISOString() }).eq('id', 1);
    setMsg(error ? friendlyError(error) : 'Paramètres enregistrés. Les invitations utilisent déjà ces réglages.');
    reload();
  };

  return (
    <form className="stack" onSubmit={save}>
      <header className="page-head page-head--save">
        <h1>Thème et paramètres</h1>
        <button className="btn">Enregistrer les paramètres</button>
      </header>
      {msg && <p className="form-msg" role="status">{msg}</p>}

      <section className="panel form-grid">
        <h2 className="field--full">Le mariage</h2>
        <label className="field"><span>Prénoms des mariés (séparés par « & »)</span><input required value={form.couple_names} onChange={(e) => set('couple_names', e.target.value)} /></label>
        <label className="field"><span>WhatsApp de contact des mariés</span><input type="tel" value={form.contact_phone || ''} onChange={(e) => set('contact_phone', e.target.value)} /></label>
        <label className="field"><span>Date du mariage</span><input type="date" value={form.wedding_date || ''} onChange={(e) => set('wedding_date', e.target.value)} /></label>
        <label className="field"><span>Date limite des réponses</span><input type="date" value={form.rsvp_deadline || ''} onChange={(e) => set('rsvp_deadline', e.target.value)} /></label>
        <label className="field"><span>Mot d’accueil (français)</span><textarea rows={3} value={form.welcome_fr || ''} onChange={(e) => set('welcome_fr', e.target.value)} /></label>
        <label className="field"><span>Mot d’accueil (anglais)</span><textarea rows={3} value={form.welcome_en || ''} onChange={(e) => set('welcome_en', e.target.value)} /></label>
        <label className="field"><span>Message de remerciement (français)</span><textarea rows={4} value={form.thanks_fr || ''} onChange={(e) => set('thanks_fr', e.target.value)} /></label>
        <label className="field"><span>Message de remerciement (anglais)</span><textarea rows={4} value={form.thanks_en || ''} onChange={(e) => set('thanks_en', e.target.value)} /></label>
        <p className="muted field--full">Dans les remerciements, {'{cher}'} devient « Cher », « Chère », « Chers » ou « Chères » selon les personnes présentes et leur civilité (« Dear » en anglais), {'{noms}'} leurs prénoms et {'{couple}'} les prénoms des mariés.</p>
      </section>

      <section className="panel">
        <h2>Couleurs de l’application</h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button type="button" key={p.name} className="preset" onClick={() => setTheme(p.theme)}>
              <span className="preset__dots">
                {Object.values(p.theme).map((c) => <i key={c} style={{ background: c }} />)}
              </span>
              {p.name}
            </button>
          ))}
        </div>
        <div className="colors">
          {COLOR_LABELS.map(({ key, label }) => (
            <label key={key} className="color-field">
              <input type="color" value={theme[key]} onChange={(e) => setTheme({ ...theme, [key]: e.target.value })} />
              <span>{label}<br /><code>{theme[key]}</code></span>
            </label>
          ))}
        </div>
        <div className="theme-preview" aria-label="Aperçu">
          <span className="theme-preview__names">{form.couple_names}</span>
          <span className="theme-preview__rule" />
          <span className="theme-preview__date">Aperçu des couleurs</span>
        </div>
      </section>
      <div className="form-actions form-actions--page">
        <button className="btn">Enregistrer les paramètres</button>
      </div>
    </form>
  );
}
