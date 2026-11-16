import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { downloadCsv } from '../../lib/share';
import { eventTitle, fmtDateTime } from '../../lib/format';
import { invitationName } from '../../lib/people';
import type { EventItem, Invitation } from '../../lib/types';

export default function Dashboard() {
  const { profile, hasRole } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [ev, inv] = await Promise.all([
        supabase.from('events').select('*').order('starts_at'),
        supabase.from('invitations').select('*, guests(*, rsvps(*)), invitation_events(event_id)').order('created_at', { ascending: false }),
      ]);
      setEvents((ev.data as EventItem[]) || []);
      setInvitations((inv.data as Invitation[]) || []);
      setLoaded(true);
    })();
  }, []);

  const guests = invitations.flatMap((i) => i.guests || []);
  const children = guests.filter((g) => g.is_child).length;
  const present = guests.filter((g) => g.checked_in_at).length;
  const opened = invitations.filter((i) => i.opened_at).length;

  const perEvent = events.map((e) => {
    const invited = invitations.filter((i) => i.invitation_events?.some((x) => x.event_id === e.id)).flatMap((i) => i.guests || []);
    let yes = 0;
    let remote = 0;
    let no = 0;
    invited.forEach((g) => {
      const r = g.rsvps?.find((x) => x.event_id === e.id);
      if (r?.status === 'yes') yes++;
      else if (r?.status === 'remote') remote++;
      else if (r?.status === 'no') no++;
    });
    return { e, invited: invited.length, yes, remote, no, waiting: invited.length - yes - remote - no };
  });

  const showRemote = perEvent.some((p) => p.e.stream_url || p.remote > 0);
  const STATUS_LABEL = { yes: 'sur place', remote: 'en ligne', no: 'absent' } as const;

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [['Invitation', 'Civilité', 'Invité', 'Enfant', 'Table', ...events.map((e) => eventTitle(e, 'fr')), 'Arrivée']];
    invitations.forEach((i) =>
      (i.guests || []).forEach((g) =>
        rows.push([
          invitationName(i),
          g.civility || '',
          g.full_name,
          g.is_child ? 'oui' : 'non',
          g.table_label,
          ...events.map((e) => {
            if (!i.invitation_events?.some((x) => x.event_id === e.id)) return 'non invité';
            const r = g.rsvps?.find((x) => x.event_id === e.id);
            return r ? STATUS_LABEL[r.status] : 'sans réponse';
          }),
          g.checked_in_at ? fmtDateTime(g.checked_in_at) : '',
        ]),
      ),
    );
    downloadCsv('invites-mariage.csv', rows);
  };

  if (!loaded) return <p className="muted">Chargement…</p>;

  const quotaUsed = guests.length;
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Tableau de bord</h1>
        {hasRole('admin', 'inviter') && <button className="btn btn--ghost" onClick={exportCsv}>Exporter la liste (CSV)</button>}
      </header>

      {profile?.role === 'inviter' && (
        <div className="panel">
          <p>
            Vous avez invité <strong>{quotaUsed}</strong> personne{quotaUsed > 1 ? 's' : ''} sur un quota de{' '}
            <strong>{profile.quota}</strong>.
          </p>
          <div className="meter"><span style={{ width: `${Math.min(100, (quotaUsed / Math.max(1, profile.quota)) * 100)}%` }} /></div>
        </div>
      )}

      <div className="stats">
        <Stat label="Invitations" value={invitations.length} sub={`${opened} ouvertes`} />
        <Stat label="Invités" value={guests.length} sub={`${guests.length - children} adultes, ${children} enfants`} />
        <Stat label="Arrivés le jour J" value={present} sub={guests.length ? `${Math.round((present / guests.length) * 100)} % des invités` : '—'} />
      </div>

      <section className="panel">
        <h2>Réponses par moment de la journée</h2>
        {perEvent.length === 0 && <p className="muted">Aucun moment créé. <Link to="/admin/events">Créer le programme</Link></p>}
        <div className="table-wrap">
          <table className="table table--cards">
            <thead>
              <tr><th>Moment</th><th>Invités</th><th>Sur place</th>{showRemote && <th>En ligne</th>}<th>Absents</th><th>Sans réponse</th></tr>
            </thead>
            <tbody>
              {perEvent.map(({ e, invited, yes, remote, no, waiting }) => (
                <tr key={e.id}>
                  <td className="table__title">{eventTitle(e, 'fr')}<br /><small className="muted">{fmtDateTime(e.starts_at)}</small></td>
                  <td data-label="Invités">{invited}</td>
                  <td data-label="Sur place" className="ok">{yes}</td>
                  {showRemote && <td data-label="En ligne">{e.stream_url || remote ? remote : '—'}</td>}
                  <td data-label="Absents">{no}</td>
                  <td data-label="Sans réponse" className={waiting ? 'warn' : ''}>{waiting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {hasRole('admin', 'inviter') && (
        <section className="panel">
          <h2>Invitations pas encore ouvertes</h2>
          {invitations.filter((i) => !i.opened_at).length === 0 ? (
            <p className="muted">Toutes les invitations envoyées ont été ouvertes.</p>
          ) : (
            <ul className="plain-list">
              {invitations.filter((i) => !i.opened_at).slice(0, 12).map((i) => (
                <li key={i.id}>{invitationName(i)} <small className="muted">({i.guests?.length || 0} pers.)</small></li>
              ))}
            </ul>
          )}
          <Link to="/admin/invitations">Gérer les invitations</Link>
        </section>
      )}

      {hasRole('security') && (
        <Link className="btn" to="/admin/checkin">Ouvrir l’accueil des invités</Link>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
      <span className="stat__sub">{sub}</span>
    </div>
  );
}
