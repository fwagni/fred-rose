import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { CardData } from '../lib/card';

interface Labels {
  pdf: string;
  image: string;
  working: string;
  error: string;
}

/**
 * Boutons « Télécharger en PDF » et « Enregistrer en image » de la carte d'invitation (A5).
 * Le moteur de dessin (lib/card.ts) n'est chargé qu'au clic.
 */
export default function CardExport({ card, labels, filename, buttonClass }: { card: CardData; labels: Labels; filename: string; buttonClass: string }) {
  const qrBox = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'pdf' | 'image' | null>(null);
  const [error, setError] = useState(false);

  const run = async (kind: 'pdf' | 'image') => {
    const qr = qrBox.current?.querySelector('canvas');
    if (!qr) return;
    setBusy(kind);
    setError(false);
    try {
      const { renderCard, cardToPdf, cardToImage, saveFile } = await import('../lib/card');
      const canvas = await renderCard(card, qr);
      if (kind === 'pdf') await saveFile(await cardToPdf(canvas), `${filename}.pdf`);
      else await saveFile(await cardToImage(canvas), `${filename}.jpg`);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card-export">
      <div ref={qrBox} hidden>
        <QRCodeCanvas value={card.url} size={660} level="M" marginSize={0} bgColor="#FFFFFF" fgColor="#121A33" />
      </div>
      <button type="button" className={buttonClass} onClick={() => run('pdf')} disabled={busy !== null}>
        {busy === 'pdf' ? labels.working : labels.pdf}
      </button>
      <button type="button" className={buttonClass} onClick={() => run('image')} disabled={busy !== null}>
        {busy === 'image' ? labels.working : labels.image}
      </button>
      {error && <p className="card-export__error" role="alert">{labels.error}</p>}
    </div>
  );
}
