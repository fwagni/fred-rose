import { useEffect, useState, type FormEvent } from 'react';
import { supabase, friendlyError } from '../../lib/supabase';
import { fmtDateTime, fromDoualaInput, toDoualaInput } from '../../lib/format';
import type { EventItem } from '../../lib/types';
import Modal from '../../components/Modal';

const EMPTY: Partial<EventItem> = { title_fr: '', title_en: '', venue_name: '', address: '', map_url: '', stream_url: '', notes_fr: '', notes_en: '', sort_order: 0 };

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const { data } = await supabase.from('events').select('*').order('starts_at');
    setEvents((data as EventItem[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const edit = (e: Partial<EventItem>) => {
    setEditing({ ...e });
    setStart(toDoualaInput(e.starts_at));
    setEnd(toDoualaInput(e.ends_at));
    setMsg('');
  };

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    const row = { ...editing, stream_url: editing.stream_url?.trim() || null, starts_at: fromDoualaInput(start), ends_at: fromDoualaInput(end) };
    delete (row as { created_at?: string }).created_at;
    const { error } = editing.id
      ? await supabase.from('events').update(row).eq('id', editing.id)
      : await supabase.from('events').insert(row);
    if (error) return setMsg(friendlyError(error));
    setEditing(null);
    load();
  };

  const remove = async (e: EventItem) => {
    if (!confirm(`Supprimer « ${e.title_fr} » ? Les réponses des invités pour ce moment seront aussi supprimées.`)) return;
    await supabase.from('events').delete().eq('id', e.id);
    load();
  };

  const set = (k: keyof EventItem, v: string) => setEditing({ ...editing, [k]: v });

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Programme de la journée</h1>
        <button className="btn" onClick={() => edit(EMPTY)}>Ajouter un moment</button>
      </header>
      <p className="muted">Les heures sont celles de Douala. Chaque invitation peut inclure tout ou partie de ces moments.</p>
      {events.length === 0 && <div className="panel">Aucun moment pour l’instant. Ajoutez la cérémonie civile, le discours et la soirée.</div>}
      <ol className="event-list">
        {events.map((e) => (
          <li key={e.id} className="panel event-row">
            <div>
              <strong>{e.title_fr}</strong> {e.title_en && <span className="muted">/ {e.title_en}</span>}
              <p className="muted">{fmtDateTime(e.starts_at)} · {e.venue_name}</p>
              {e.stream_url && <span className="badge">Visioconférence</span>}
            </div>
            <div className="row-actions">
              <button className="btn btn--ghost" onClick={() => edit(e)}>Modifier</button>
              <button className="btn btn--ghost btn--danger" onClick={() => remove(e)}>Supprimer</button>
            </div>
          </li>
        ))}
      </ol>

      {editing && (
        <Modal title={editing.id ? 'Modifier le moment' : 'Nouveau moment'} onClose={() => setEditing(null)} wide>
          <form className="form-grid" onSubmit={save}>
            <label className="field"><span>Titre en français</span><input required value={editing.title_fr || ''} onChange={(e) => set('title_fr', e.target.value)} /></label>
            <label className="field"><span>Titre en anglais</span><input value={editing.title_en || ''} onChange={(e) => set('title_en', e.target.value)} /></label>
            <label className="field"><span>Début</span><input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="field"><span>Fin (facultatif)</span><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
            <label className="field"><span>Lieu</span><input value={editing.venue_name || ''} onChange={(e) => set('venue_name', e.target.value)} /></label>
            <label className="field"><span>Adresse</span><input value={editing.address || ''} onChange={(e) => set('address', e.target.value)} /></label>
            <label className="field field--full"><span>Lien Google Maps</span><input type="url" value={editing.map_url || ''} onChange={(e) => set('map_url', e.target.value)} placeholder="https://maps.google.com/…" /></label>
            <label className="field field--full">
              <span>Lien de visioconférence (facultatif)</span>
              <input type="url" value={editing.stream_url || ''} onChange={(e) => set('stream_url', e.target.value)} placeholder="https://meet.google.com/… ou https://youtube.com/live/…" aria-describedby="stream-hint" />
              <small id="stream-hint" className="muted">
                Renseigné, ce lien permet aux invités de répondre « En ligne » et affiche un bouton « Suivre en ligne » sur leur invitation.
                Google Meet, Zoom (40 min en gratuit) ou un direct YouTube conviennent.
              </small>
            </label>
            <label className="field"><span>Consignes aux invités (français)</span><textarea rows={3} value={editing.notes_fr || ''} onChange={(e) => set('notes_fr', e.target.value)} /></label>
            <label className="field"><span>Consignes aux invités (anglais)</span><textarea rows={3} value={editing.notes_en || ''} onChange={(e) => set('notes_en', e.target.value)} /></label>
            {msg && <p className="form-msg field--full" role="alert">{msg}</p>}
            <div className="field--full form-actions">
              <button className="btn">Enregistrer le moment</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
