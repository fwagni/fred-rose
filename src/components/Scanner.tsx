import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type CamState = 'checking' | 'ask' | 'starting' | 'running' | 'denied' | 'nocamera' | 'insecure' | 'error';

const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Lecteur de QR code via la caméra arrière du téléphone.
 * Demande d'abord l'autorisation explicitement (bouton, donc geste de l'utilisateur, exigé par iOS),
 * puis démarre la lecture. En cas de refus, explique comment réautoriser la caméra.
 */
export default function Scanner({ onScan, onUseSearch }: { onScan: (text: string) => void; onUseSearch?: () => void }) {
  const cb = useRef(onScan);
  const last = useRef({ text: '', at: 0 });
  const qr = useRef<Html5Qrcode | null>(null);
  const mounted = useRef(true);
  const [state, setState] = useState<CamState>('checking');
  cb.current = onScan;

  const start = useCallback(async () => {
    setState('starting');
    try {
      // Déclenche la fenêtre d'autorisation du navigateur, puis libère la caméra pour le lecteur.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      stream.getTracks().forEach((t) => t.stop());
      if (!mounted.current) return;
      const reader = qr.current ?? new Html5Qrcode('qr-reader', { verbose: false });
      qr.current = reader;
      await reader.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (text) => {
          const now = Date.now();
          if (text === last.current.text && now - last.current.at < 3000) return;
          last.current = { text, at: now };
          if (navigator.vibrate) navigator.vibrate(60);
          cb.current(text);
        },
        () => undefined,
      );
      if (mounted.current) setState('running');
    } catch (err) {
      if (!mounted.current) return;
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setState('nocamera');
      else setState('error');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let status: PermissionStatus | null = null;
    const onChange = () => status?.state === 'granted' && start();

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState('insecure');
    } else if (navigator.permissions?.query) {
      // Si la caméra est déjà autorisée, on démarre directement ; sinon on affiche l'explication.
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((s) => {
          status = s;
          s.addEventListener('change', onChange);
          if (s.state === 'granted') start();
          else setState(s.state === 'denied' ? 'denied' : 'ask');
        })
        .catch(() => setState('ask'));
    } else {
      setState('ask');
    }

    return () => {
      mounted.current = false;
      status?.removeEventListener('change', onChange);
      const reader = qr.current;
      if (reader?.isScanning) reader.stop().then(() => reader.clear()).catch(() => undefined);
    };
  }, [start]);

  const searchLink = onUseSearch && (
    <button type="button" className="link-btn" onClick={onUseSearch}>Chercher l’invité par son nom</button>
  );

  return (
    <div className="scanner">
      <div id="qr-reader" hidden={state !== 'running' && state !== 'starting'} />

      {state === 'checking' && <p className="muted">Préparation de la caméra…</p>}
      {state === 'starting' && <p className="muted" role="status">Ouverture de la caméra…</p>}

      {state === 'ask' && (
        <div className="panel cam-ask">
          <h2>Autoriser la caméra</h2>
          <p>
            Pour lire les QR codes des invités, l’application a besoin de la caméra de ce téléphone. Votre navigateur va vous
            demander l’autorisation : choisissez <strong>Autoriser</strong>.
          </p>
          <p className="muted">Les images restent sur le téléphone : rien n’est enregistré ni envoyé.</p>
          <button type="button" className="btn" onClick={start}>Autoriser la caméra</button>
          {searchLink}
        </div>
      )}

      {state === 'denied' && (
        <div className="panel cam-ask" role="alert">
          <h2>Caméra refusée</h2>
          <p>L’accès à la caméra a été refusé. Pour scanner, réautorisez-la :</p>
          {isIos() ? (
            <ol>
              <li>Touchez <strong>aA</strong> (ou <strong>⋯</strong>) dans la barre d’adresse de Safari.</li>
              <li>Ouvrez <strong>Réglages du site web</strong>, puis <strong>Caméra</strong> : choisissez <strong>Autoriser</strong>.</li>
              <li>Si rien ne change : Réglages de l’iPhone &gt; Safari &gt; Caméra &gt; Autoriser.</li>
            </ol>
          ) : (
            <ol>
              <li>Touchez le <strong>cadenas</strong> (ou l’icône de réglages) à gauche de l’adresse.</li>
              <li>Ouvrez <strong>Autorisations</strong>, puis <strong>Caméra</strong> : choisissez <strong>Autoriser</strong>.</li>
            </ol>
          )}
          <button type="button" className="btn" onClick={start}>Réessayer</button>
          {searchLink}
        </div>
      )}

      {state === 'nocamera' && (
        <div className="panel cam-ask" role="alert">
          <p>Aucune caméra n’a été trouvée sur cet appareil. Utilisez un téléphone, ou cherchez l’invité par son nom.</p>
          {searchLink}
        </div>
      )}

      {state === 'insecure' && (
        <div className="panel cam-ask" role="alert">
          <p>
            La caméra n’est disponible que sur une adresse sécurisée (<strong>https://</strong>). Ouvrez l’application depuis son
            adresse en ligne, ou cherchez l’invité par son nom.
          </p>
          {searchLink}
        </div>
      )}

      {state === 'error' && (
        <div className="panel cam-ask" role="alert">
          <p>La caméra n’a pas pu démarrer. Fermez les autres applications qui l’utilisent, puis réessayez.</p>
          <button type="button" className="btn" onClick={start}>Réessayer</button>
          {searchLink}
        </div>
      )}
    </div>
  );
}
