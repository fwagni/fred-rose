import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, friendlyError } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../lib/useSettings';
import { eventTitle, fmtLongDate } from '../../lib/format';
import { copyText, invitationMessage, invitationUrl, mailtoUrl, whatsappUrl } from '../../lib/share';
import { CIVILITIES, invitationName, peopleLabel, personLabel } from '../../lib/people';
import type { Civility, EventItem, Guest, Invitation, Lang, TemplateId } from '../../lib/types';
import Modal from '../../components/Modal';
import CardExport from '../../components/CardExport';

const TEMPLATES: { id: TemplateId; name: string; desc: string }[] = [
  { id: 'marine', name: 'Marine et or', desc: 'Fond bleu nuit, filets dorés' },
  { id: 'jardin', name: 'Jardin', desc: 'Ivoire et feuillage' },
  { id: 'ivoire', name: 'Ivoire', desc: 'Sobre, typographie seule' },
  { id: 'nuit', name: 'Nuit étoilée', desc: 'Bleu profond et étoiles d’or' },
];

interface DraftGuest {
  id?: string;
  civility: Civility | '';
  full_name: string;
  is_child: boolean;
  table_label: string;
}
const EMPTY_GUEST: DraftGuest = { civility: '', full_name: '', is_child: false, table_label: '' };
const guestRow = (g: DraftGuest) => ({
  full_name: g.full_name.trim(),
  civility: g.civility || null,
  is_child: g.is_child,
  table_label: g.table_label.trim() || null,
});

interface Draft {
  id?: string;
  token?: string;
  household_name: string;
  language: Lang;
  template: TemplateId;
  phone: string;
  email: string;
  message: string;
  events: string[];
  guests: DraftGuest[];
}

type Filter = 'all' | 'unopened' | 'waiting' | 'answered';

export default function InvitationsPage() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [list, setList] = useState<Invitation[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [qrFor, setQrFor] = useState<Invitation | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [msg, setMsg] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [moreFor, setMoreFor] = useState<string | null>(null);

  const load = async () => {
    const [inv, ev] = await Promise.all([
      supabase.from('invitations').select('*, guests(*, rsvps(*)), invitation_events(event_id)').order('created_at', { ascending: false }),
      supabase.from('events').select('*').order('starts_at'),
    ]);
    setList((inv.data as Invitation[]) || []);
    setEvents((ev.data as EventItem[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2500);
  };

  const used = list.filter((i) => i.inviter_id === profile?.id).flatMap((i) => i.guests || []).length;
  const isInviter = profile?.role === 'inviter';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((i) => {
      const hay = [i.household_name || '', ...(i.guests || []).map((g) => g.full_name)].join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      const answered = (i.guests || []).some((g) => (g.rsvps || []).length > 0);
      if (filter === 'unopened') return !i.opened_at;
      if (filter === 'waiting') return !answered;
      if (filter === 'answered') return answered;
      return true;
    });
  }, [list, query, filter]);

  const startNew = () => {
    setMsg('');
    setDraft({
      household_name: '',
      language: 'fr',
      template: 'marine',
      phone: '',
      email: '',
      message: '',
      events: events.map((e) => e.id),
      guests: [{ ...EMPTY_GUEST }],
    });
  };

  const startEdit = (i: Invitation) => {
    setMsg('');
    setDraft({
      id: i.id,
      token: i.token,
      household_name: i.household_name || '',
      language: i.language,
      template: i.template,
      phone: i.phone || '',
      email: i.email || '',
      message: i.message || '',
      events: (i.invitation_events || []).map((x) => x.event_id),
      guests: (i.guests || []).map((g: Guest) => ({
        id: g.id,
        civility: g.civility || '',
        full_name: g.full_name,
        is_child: g.is_child,
        table_label: g.table_label || '',
      })),
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const members = draft.guests.filter((g) => g.full_name.trim());
    if (members.length === 0) return setMsg('Ajoutez au moins une personne nommée.');
    if (draft.events.length === 0) return setMsg('Cochez au moins un moment de la journée.');
    setBusy(true);
    setMsg('');
    const row = {
      household_name: draft.household_name.trim() || null,
      language: draft.language,
      template: draft.template,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      message: draft.message.trim() || null,
    };
    try {
      let id = draft.id;
      if (!id) {
        const { data, error } = await supabase.from('invitations').insert(row).select('id').single();
        if (error) throw error;
        id = data.id as string;
        const { error: gErr } = await supabase.from('guests').insert(members.map((g) => ({ invitation_id: id, ...guestRow(g) })));
        if (gErr) {
          await supabase.from('invitations').delete().eq('id', id);
          throw gErr;
        }
      } else {
        const { error } = await supabase.from('invitations').update(row).eq('id', id);
        if (error) throw error;
        const original = list.find((i) => i.id === id)?.guests || [];
        const keptIds = members.filter((g) => g.id).map((g) => g.id);
        const removed = original.filter((g) => !keptIds.includes(g.id)).map((g) => g.id);
        if (removed.length) await supabase.from('guests').delete().in('id', removed);
        for (const g of members.filter((m) => m.id)) {
          const { error: uErr } = await supabase.from('guests').update(guestRow(g)).eq('id', g.id!);
          if (uErr) throw uErr;
        }
        const added = members.filter((m) => !m.id);
        if (added.length) {
          const { error: gErr } = await supabase.from('guests').insert(added.map((g) => ({ invitation_id: id, ...guestRow(g) })));
          if (gErr) throw gErr;
        }
        await supabase.from('invitation_events').delete().eq('invitation_id', id);
      }
      const { error: evErr } = await supabase.from('invitation_events').insert(draft.events.map((event_id) => ({ invitation_id: id, event_id })));
      if (evErr) throw evErr;
      setDraft(null);
      flash('Invitation enregistrée');
      load();
    } catch (err) {
      setMsg(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (i: Invitation) => {
    if (!confirm(`Supprimer l’invitation de « ${invitationName(i)} » ? Son lien ne fonctionnera plus.`)) return;
    await supabase.from('invitations').delete().eq('id', i.id);
    load();
  };

  const shareText = (i: Invitation) =>
    invitationMessage({
      lang: i.language,
      guests: i.guests || [],
      couple: settings?.couple_names || '',
      date: fmtLongDate(settings?.wedding_date, i.language),
      url: invitationUrl(i.token),
    });

  const updateGuest = (idx: number, patch: Partial<DraftGuest>) => {
    if (!draft) return;
    const guests = draft.guests.map((g, i) => (i === idx ? { ...g, ...patch } : g));
    setDraft({ ...draft, guests });
  };

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Invitations</h1>
        <button className="btn" onClick={startNew} disabled={events.length === 0}>Nouvelle invitation</button>
      </header>
      {events.length === 0 && <div className="panel">Le programme est vide : l’administrateur doit d’abord créer les moments de la journée.</div>}
      {isInviter && (
        <div className="panel">
          Quota : <strong>{used}</strong> / {profile?.quota} personnes invitées.
          <div className="meter"><span style={{ width: `${Math.min(100, (used / Math.max(1, profile?.quota || 1)) * 100)}%` }} /></div>
        </div>
      )}

      <div className="toolbar">
        <input className="search" type="search" placeholder="Rechercher une invitation ou une personne" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filtrer">
          <option value="all">Toutes ({list.length})</option>
          <option value="unopened">Pas encore ouvertes</option>
          <option value="waiting">Sans réponse</option>
          <option value="answered">Avec réponse</option>
        </select>
      </div>

      <ul className="inv-list">
        {filtered.map((i) => {
          const gs = i.guests || [];
          const yes = gs.filter((g) => g.rsvps?.some((r) => r.status === 'yes')).length;
          const remote = gs.filter((g) => !g.rsvps?.some((r) => r.status === 'yes') && g.rsvps?.some((r) => r.status === 'remote')).length;
          const answered = gs.filter((g) => (g.rsvps || []).length > 0).length;
          return (
            <li key={i.id} className="panel inv-row">
              <div className="inv-row__main">
                <strong>{invitationName(i)}</strong>
                {(i.household_name || gs.some((g) => g.is_child)) && (
                  <span className="muted">{gs.map((g) => personLabel(g) + (g.is_child ? ' (enfant)' : '')).join(', ')}</span>
                )}
                <div className="badges">
                  <span className={`badge ${i.opened_at ? 'badge--ok' : ''}`}>{i.opened_at ? 'Ouverte' : 'Non ouverte'}</span>
                  <span className="badge">{gs.length > 1 ? `${gs.length} personnes` : '1 personne'}</span>
                  <span className="badge">
                    {answered ? `${yes} sur place${remote ? `, ${remote} en ligne` : ''} sur ${gs.length}` : 'Sans réponse'}
                  </span>
                  <span className="badge">{(i.invitation_events || []).length} moment(s)</span>
                  <span className="badge">{i.language.toUpperCase()}</span>
                </div>
              </div>
              <div className="row-actions">
                <a className="btn btn--wa" href={whatsappUrl(i.phone, shareText(i))} target="_blank" rel="noreferrer">WhatsApp</a>
                <button className="btn btn--ghost" onClick={async () => flash((await copyText(invitationUrl(i.token))) ? 'Lien copié' : 'Copie impossible')}>Copier le lien</button>
                <button className="btn btn--ghost" onClick={() => startEdit(i)}>Modifier</button>
                <div className={`more ${moreFor === i.id ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="btn btn--ghost more__toggle"
                    aria-expanded={moreFor === i.id}
                    aria-controls={`more-${i.id}`}
                    onClick={() => setMoreFor(moreFor === i.id ? null : i.id)}
                  >
                    {moreFor === i.id ? 'Moins d’actions' : 'Plus d’actions'}
                  </button>
                  <div id={`more-${i.id}`} className="more__items">
                    {i.email && <a className="btn btn--ghost" href={mailtoUrl(i.email, i.language === 'en' ? 'Wedding invitation' : 'Invitation au mariage', shareText(i))}>E-mail</a>}
                    <button className="btn btn--ghost" onClick={() => setQrFor(i)}>QR code et carte</button>
                    <a className="btn btn--ghost" href={`/i/${i.token}?preview=1`} target="_blank" rel="noreferrer">Aperçu</a>
                    <button className="btn btn--ghost btn--danger" onClick={() => remove(i)}>Supprimer</button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && list.length > 0 && <p className="muted">Aucune invitation ne correspond à cette recherche.</p>}

      {draft && (
        <Modal title={draft.id ? 'Modifier l’invitation' : 'Nouvelle invitation'} onClose={() => setDraft(null)} wide>
          <form className="form-grid" onSubmit={save}>
            <label className="field field--full">
              <span>Nom affiché sur l’invitation (facultatif)</span>
              <input
                value={draft.household_name}
                onChange={(e) => setDraft({ ...draft, household_name: e.target.value })}
                placeholder={peopleLabel(draft.guests.filter((g) => g.full_name.trim()).map((g) => ({ ...g, civility: g.civility || null }))) || 'Ex. Famille Ngo Bassa'}
                aria-describedby="household-hint"
              />
              <small id="household-hint" className="muted">
                Laissez vide pour afficher les noms des personnes. Utile pour un groupe : « Famille Ngo Bassa », « M. et Mme Ngo ».
              </small>
            </label>

            <fieldset className="field--full members">
              <legend>Personnes invitées : une ou plusieurs (chacune est comptée dans le quota)</legend>
              {draft.guests.map((g, idx) => (
                <div key={idx} className="member-row">
                  <select
                    aria-label="Civilité"
                    className="member-row__civ"
                    value={g.civility}
                    onChange={(e) => updateGuest(idx, { civility: e.target.value as Civility | '' })}
                  >
                    <option value="">Civilité</option>
                    {CIVILITIES.map((c) => <option key={c.id} value={c.id}>{c.fr}</option>)}
                  </select>
                  <input aria-label="Nom complet" placeholder="Nom complet" className="member-row__name" value={g.full_name} onChange={(e) => updateGuest(idx, { full_name: e.target.value })} />
                  <input aria-label="Table" placeholder="Table" className="member-row__table" value={g.table_label} onChange={(e) => updateGuest(idx, { table_label: e.target.value })} />
                  <label className="check member-row__child"><input type="checkbox" checked={g.is_child} onChange={(e) => updateGuest(idx, { is_child: e.target.checked })} /> Enfant</label>
                  <button type="button" className="btn btn--ghost member-row__remove" aria-label={`Retirer ${g.full_name || 'cette personne'}`} onClick={() => setDraft({ ...draft, guests: draft.guests.filter((_, i) => i !== idx) })}>✕</button>
                </div>
              ))}
              <button type="button" className="link-btn" onClick={() => setDraft({ ...draft, guests: [...draft.guests, { ...EMPTY_GUEST }] })}>
                Ajouter une personne
              </button>
            </fieldset>

            <fieldset className="field--full">
              <legend>Moments auxquels {draft.guests.length > 1 ? 'ces personnes sont invitées' : 'cette personne est invitée'}</legend>
              <div className="checks">
                {events.map((ev) => (
                  <label key={ev.id} className="check">
                    <input
                      type="checkbox"
                      checked={draft.events.includes(ev.id)}
                      onChange={(e) => setDraft({ ...draft, events: e.target.checked ? [...draft.events, ev.id] : draft.events.filter((x) => x !== ev.id) })}
                    />
                    {eventTitle(ev, 'fr')}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="field--full">
              <legend>Modèle visuel</legend>
              <div className="tpl-picker">
                {TEMPLATES.map((t) => (
                  <label key={t.id} className={`tpl-option tpl-option--${t.id} ${draft.template === t.id ? 'is-on' : ''}`}>
                    <input type="radio" name="tpl" checked={draft.template === t.id} onChange={() => setDraft({ ...draft, template: t.id })} />
                    <span className="tpl-option__swatch" aria-hidden="true" />
                    <strong>{t.name}</strong>
                    <small>{t.desc}</small>
                  </label>
                ))}
              </div>
              {draft.token && (
                <a href={`/i/${draft.token}?preview=1&template=${draft.template}`} target="_blank" rel="noreferrer">Voir l’aperçu avec ce modèle</a>
              )}
            </fieldset>

            <label className="field">
              <span>Langue de l’invitation</span>
              <select value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as Lang })}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="field">
              <span>Numéro WhatsApp (reçoit le message d’invitation)</span>
              <input type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="6 99 12 34 56" />
            </label>
            <label className="field">
              <span>E-mail (facultatif)</span>
              <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="field field--full">
              <span>Mot personnel (facultatif, affiché sur l’invitation)</span>
              <textarea rows={2} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
            </label>
            {msg && <p className="form-msg field--full" role="alert">{msg}</p>}
            <div className="field--full form-actions">
              <button className="btn" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer l’invitation'}</button>
            </div>
          </form>
        </Modal>
      )}

      {qrFor && (
        <Modal title={`QR code et carte – ${invitationName(qrFor)}`} onClose={() => setQrFor(null)}>
          <div className="qr-box">
            <QRCodeSVG value={invitationUrl(qrFor.token)} size={240} level="M" marginSize={2} />
            <p className="muted">Ce code ouvre l’invitation et sert de pass d’entrée.</p>
          </div>
          <h3 className="card-export__title">Carte à imprimer (A5, 148 × 210 mm)</h3>
          <p className="muted">
            Faire-part prêt pour l’imprimeur ou pour WhatsApp, dans la langue et le modèle de l’invitation, avec ce QR code.
          </p>
          <CardExport
            card={{
              lang: qrFor.language,
              template: qrFor.template,
              theme: settings?.theme ?? null,
              couple: settings?.couple_names || '',
              weddingDate: settings?.wedding_date ?? null,
              rsvpDeadline: settings?.rsvp_deadline ?? null,
              invitees: invitationName(qrFor, qrFor.language),
              events: events.filter((e) => qrFor.invitation_events?.some((x) => x.event_id === e.id)),
              url: invitationUrl(qrFor.token),
            }}
            labels={{ pdf: 'Télécharger en PDF', image: 'Télécharger en image', working: 'Préparation…', error: 'La carte n’a pas pu être créée. Réessayez.' }}
            filename={`invitation-${invitationName(qrFor).replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}`}
            buttonClass="btn btn--ghost"
          />
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
