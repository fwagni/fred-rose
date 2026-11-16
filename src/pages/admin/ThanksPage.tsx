import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../lib/useSettings';
import { joinNames } from '../../lib/format';
import { copyText, fillTemplate, mailtoUrl, whatsappUrl } from '../../lib/share';
import i18n from '../../i18n';
import { addressForm, invitationName } from '../../lib/people';
import type { Invitation } from '../../lib/types';

export default function ThanksPage() {
  const { settings } = useSettings();
  const [list, setList] = useState<Invitation[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    const { data } = await supabase.from('invitations').select('*, guests(*)').order('created_at');
    setList(((data as Invitation[]) || []).filter((i) => (i.guests || []).some((g) => g.checked_in_at)));
  };
  useEffect(() => {
    load();
  }, []);

  const messageFor = (i: Invitation) => {
    const present = (i.guests || []).filter((g) => g.checked_in_at);
    const tpl = (i.language === 'en' ? settings?.thanks_en : settings?.thanks_fr) || '';
    return fillTemplate(tpl, {
      cher: i18n.getFixedT(i.language)(`dear.${addressForm(present)}`),
      noms: joinNames(present.map((g) => g.full_name.split(' ')[0]), i.language),
      couple: settings?.couple_names || '',
    });
  };

  const markDone = async (i: Invitation) => {
    await supabase.from('invitations').update({ thanked_at: new Date().toISOString() }).eq('id', i.id);
    load();
  };

  const shown = list.filter((i) => showDone || !i.thanked_at);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Remerciements</h1>
        <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Afficher les invitations déjà remerciées</label>
      </header>
      <p className="muted">
        Seules les invitations dont au moins une personne a été pointée à l’entrée apparaissent ici. Chaque bouton WhatsApp ouvre
        la conversation avec le message prêt : il suffit d’appuyer sur Envoyer. Le texte se modifie dans Thème et paramètres.
      </p>
      {list.length === 0 && <div className="panel">Aucun invité pointé pour l’instant. Cette page se remplit le jour du mariage.</div>}
      <ul className="inv-list">
        {shown.map((i) => {
          const text = messageFor(i);
          return (
            <li key={i.id} className="panel inv-row">
              <div className="inv-row__main">
                <strong>{invitationName(i)}</strong>
                <p className="thanks-preview">{text}</p>
                {i.thanked_at && <span className="badge badge--ok">Remercié</span>}
              </div>
              <div className="row-actions">
                <a className="btn btn--wa" href={whatsappUrl(i.phone, text)} target="_blank" rel="noreferrer">WhatsApp</a>
                {i.email && <a className="btn btn--ghost" href={mailtoUrl(i.email, i18n.getFixedT(i.language)('message.thanksSubject'), text)}>E-mail</a>}
                <button className="btn btn--ghost" onClick={async () => { setToast((await copyText(text)) ? 'Message copié' : 'Copie impossible'); setTimeout(() => setToast(''), 2000); }}>Copier</button>
                {!i.thanked_at && <button className="btn btn--ghost" onClick={() => markDone(i)}>Marquer comme remercié</button>}
              </div>
            </li>
          );
        })}
      </ul>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
