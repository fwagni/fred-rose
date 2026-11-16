import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { supabase, friendlyError } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../lib/useSettings';
import { monogram } from '../../lib/theme';

export default function LoginPage() {
  const { session } = useAuth();
  const { settings } = useSettings();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('signup') ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(friendlyError(error));
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) setMsg(friendlyError(error));
      else if (!data.session) setMsg('Compte créé. Confirmez votre adresse e-mail grâce au lien reçu, puis connectez-vous.');
    }
    setBusy(false);
  };

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <div className="seal seal--small" aria-hidden="true">
          <span className="seal__mono">{monogram(settings?.couple_names || 'F & R')}</span>
        </div>
        <h1>{mode === 'login' ? 'Espace organisateurs' : 'Créer un compte organisateur'}</h1>
        {mode === 'signup' && (
          <p className="muted">Après la création, l’administrateur doit activer votre compte et vous attribuer un rôle.</p>
        )}
        {mode === 'signup' && (
          <label className="field">
            <span>Nom complet</span>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Adresse e-mail</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
        {msg && <p className="form-msg" role="alert">{msg}</p>}
        <button type="button" className="link-btn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'J’ai déjà un compte'}
        </button>
      </form>
    </div>
  );
}
