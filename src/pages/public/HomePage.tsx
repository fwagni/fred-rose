import { Link } from 'react-router-dom';
import { useSettings } from '../../lib/useSettings';
import { fmtLongDate } from '../../lib/format';
import { monogram } from '../../lib/theme';

export default function HomePage() {
  const { settings } = useSettings();
  const couple = settings?.couple_names || 'Fredoly & Rose';
  return (
    <div className="invite tpl-marine invite--center">
      <main className="home">
        <div className="seal seal--static" aria-hidden="true">
          <span className="seal__mono">{monogram(couple)}</span>
        </div>
        <h1 className="home__names">{couple}</h1>
        <p className="home__date">{fmtLongDate(settings?.wedding_date, 'fr')}</p>
        <p className="home__text">
          Vous avez reçu une invitation ? Ouvrez directement le lien personnel reçu par message.
          <br />
          <span lang="en">Received an invitation? Open the personal link sent to you.</span>
        </p>
        <Link className="home__staff" to="/admin">Espace organisateurs</Link>
      </main>
    </div>
  );
}
