import { useCallback, useEffect, useMemo, useState } from 'react';
import Scanner from '../../components/Scanner';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/format';
import { invitationName, personLabel } from '../../lib/people';
import { checkIn, extractToken, flushQueue, pendingCount, readCache, refreshCache, type CachedInvitation } from '../../lib/offline';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function CheckInPage() {
  const [cache, setCache] = useState<CachedInvitation[]>([]);
  const [mode, setMode] = useState<'scan' | 'search'>('scan');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<CachedInvitation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const sync = useCallback(async () => {
    if (navigator.onLine) {
      await flushQueue();
      try {
        setCache(await refreshCache());
      } catch {
        setCache(await readCache());
      }
    } else {
      setCache(await readCache());
    }
    setPending(await pendingCount());
  }, []);

  useEffect(() => {
    sync();
    const on = () => {
      setOnline(true);
      sync();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const timer = setInterval(() => navigator.onLine && sync(), 60_000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(timer);
    };
  }, [sync]);

  const open = (inv: CachedInvitation) => {
    setCurrent(inv);
    setSelected(inv.guests.filter((g) => !g.checked_in_at).map((g) => g.id));
    setMsg(inv.guests.every((g) => g.checked_in_at) ? { kind: 'warn', text: 'Toutes les personnes de cette invitation sont déjà entrées.' } : null);
  };

  const onScan = (text: string) => {
    const token = extractToken(text);
    const inv = token ? cache.find((i) => i.token === token) : null;
    if (inv) open(inv);
    else {
      setCurrent(null);
      setMsg({ kind: 'err', text: 'QR code inconnu. Vérifiez l’invitation, ou cherchez l’invité par son nom.' });
    }
  };

  const confirm = async () => {
    if (!current || selected.length === 0) return;
    const result = await checkIn(selected);
    const n = selected.length;
    setMsg({
      kind: 'ok',
      text: result === 'sent'
        ? `${n} personne${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}. Bienvenue !`
        : `${n} entrée${n > 1 ? 's' : ''} gardée${n > 1 ? 's' : ''} sur ce téléphone. Envoi automatique au retour du réseau.`,
    });
    setCache(await readCache());
    setPending(await pendingCount());
    setCurrent(null);
  };

  const undo = async (guestId: string) => {
    if (!navigator.onLine) return setMsg({ kind: 'warn', text: 'Annulation possible uniquement avec du réseau.' });
    await supabase.rpc('undo_check_in', { p_guest_id: guestId });
    await sync();
    setCurrent(null);
    setMsg({ kind: 'ok', text: 'Entrée annulée.' });
  };

  const all = cache.flatMap((i) => i.guests);
  const inside = all.filter((g) => g.checked_in_at).length;

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    return cache.filter((i) => norm(i.household_name || '').includes(q) || i.guests.some((g) => norm(g.full_name).includes(q))).slice(0, 20);
  }, [cache, query]);

  return (
    <div className="stack checkin">
      <header className="page-head">
        <h1>Accueil des invités</h1>
        <div className="checkin__status">
          <span className={`dot ${online ? 'dot--on' : 'dot--off'}`} /> {online ? 'En ligne' : 'Hors ligne'}
          {pending > 0 && <span className="badge">{pending} à envoyer</span>}
        </div>
      </header>
      <div className="stats stats--compact">
        <div className="stat"><span className="stat__value">{inside}</span><span className="stat__label">arrivés</span></div>
        <div className="stat"><span className="stat__value">{all.length - inside}</span><span className="stat__label">attendus</span></div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'scan'} className={mode === 'scan' ? 'is-on' : ''} onClick={() => setMode('scan')}>Scanner</button>
        <button role="tab" aria-selected={mode === 'search'} className={mode === 'search' ? 'is-on' : ''} onClick={() => setMode('search')}>Chercher un nom</button>
      </div>

      {msg && <p className={`notice notice--${msg.kind}`} role="status">{msg.text}</p>}

      {mode === 'scan' && !current && <Scanner onScan={onScan} onUseSearch={() => setMode('search')} />}
      {mode === 'search' && !current && (
        <div className="panel">
          <input className="search" type="search" placeholder="Nom de l’invité ou de l’invitation" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus aria-label="Nom" />
          <ul className="results">
            {results.map((i) => (
              <li key={i.id}>
                <button onClick={() => open(i)}>
                  <strong>{invitationName(i)}</strong>
                  {i.household_name && <span className="muted">{i.guests.map((g) => g.full_name).join(', ')}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {current && (
        <section className="panel checkin__card">
          <h2>{invitationName(current)}</h2>
          <ul className="checkin__guests">
            {current.guests.map((g) => (
              <li key={g.id}>
                {g.checked_in_at ? (
                  <div className="checkin__done">
                    <span>{personLabel(g)}{g.is_child && ' (enfant)'}</span>
                    <small>Entré·e {fmtDateTime(g.checked_in_at)}</small>
                    <button className="link-btn" onClick={() => undo(g.id)}>Annuler</button>
                  </div>
                ) : (
                  <label className="check check--big">
                    <input
                      type="checkbox"
                      checked={selected.includes(g.id)}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, g.id] : selected.filter((x) => x !== g.id))}
                    />
                    <span>{personLabel(g)}{g.is_child && ' (enfant)'}</span>
                    {g.table_label && <span className="badge">Table {g.table_label}</span>}
                  </label>
                )}
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button className="btn" disabled={selected.length === 0} onClick={confirm}>Valider l’entrée ({selected.length})</button>
            <button className="btn btn--ghost" onClick={() => setCurrent(null)}>Retour</button>
          </div>
        </section>
      )}
      <button className="link-btn" onClick={sync}>Mettre à jour la liste des invités</button>
    </div>
  );
}
