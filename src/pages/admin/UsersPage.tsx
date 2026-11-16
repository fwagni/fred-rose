import { useEffect, useState } from 'react';
import { supabase, friendlyError } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { copyText } from '../../lib/share';
import type { Profile, Role } from '../../lib/types';
import { ROLE_LABEL } from './AdminLayout';

export default function UsersPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [edits, setEdits] = useState<Record<string, { role: Role; quota: number }>>({});
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [p, inv] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('invitations').select('inviter_id, guests(id)'),
    ]);
    setUsers((p.data as Profile[]) || []);
    const counts: Record<string, number> = {};
    ((inv.data as { inviter_id: string | null; guests: { id: string }[] }[]) || []).forEach((i) => {
      if (i.inviter_id) counts[i.inviter_id] = (counts[i.inviter_id] || 0) + i.guests.length;
    });
    setUsed(counts);
    setEdits({});
  };
  useEffect(() => {
    load();
  }, []);

  const signupLink = `${window.location.origin}/admin/login?signup=1`;
  const current = (u: Profile) => edits[u.id] || { role: u.role, quota: u.quota };

  const save = async (u: Profile) => {
    const e = current(u);
    const { error } = await supabase.from('profiles').update({ role: e.role, quota: e.quota }).eq('id', u.id);
    setMsg(error ? friendlyError(error) : `Compte de ${u.full_name || u.email} mis à jour.`);
    load();
  };

  const totalQuota = users.filter((u) => u.role === 'inviter').reduce((n, u) => n + u.quota, 0);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Équipe</h1>
        <button className="btn btn--ghost" onClick={async () => setMsg((await copyText(signupLink)) ? 'Lien d’inscription copié.' : signupLink)}>
          Copier le lien d’inscription
        </button>
      </header>
      <div className="panel">
        <p>
          Envoyez le lien d’inscription aux personnes de confiance. Leur compte reste « en attente » jusqu’à ce que vous
          choisissiez leur rôle ici.
        </p>
        <ul className="plain-list">
          <li><strong>Inviteur</strong> : crée ses propres invitations, dans la limite de son quota de personnes.</li>
          <li><strong>Sécurité</strong> : scanne les QR codes et pointe les arrivées le jour J.</li>
          <li><strong>Administrateur</strong> : accès complet, sans quota.</li>
        </ul>
        <p className="muted">Total des quotas attribués aux inviteurs : {totalQuota} personnes.</p>
      </div>
      {msg && <p className="form-msg" role="status">{msg}</p>}
      <div className="table-wrap">
        <table className="table table--cards">
          <thead>
            <tr><th>Personne</th><th>Rôle</th><th>Quota</th><th>Invités</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const e = current(u);
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td className="table__title">{u.full_name || '—'}<br /><small className="muted">{u.email}</small></td>
                  <td data-label="Rôle">
                    <select value={e.role} disabled={self} onChange={(ev) => setEdits({ ...edits, [u.id]: { ...e, role: ev.target.value as Role } })} aria-label="Rôle">
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td data-label="Quota">
                    <input
                      type="number"
                      min={0}
                      className="num"
                      disabled={e.role !== 'inviter'}
                      value={e.quota}
                      onChange={(ev) => setEdits({ ...edits, [u.id]: { ...e, quota: Number(ev.target.value) } })}
                      aria-label="Quota"
                    />
                  </td>
                  <td data-label="Invités">{used[u.id] || 0}</td>
                  <td className="table__action">{!self && <button className="btn btn--ghost" disabled={!edits[u.id]} onClick={() => save(u)}>Enregistrer</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
