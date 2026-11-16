import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../lib/useSettings';
import type { Role } from '../../lib/types';

const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/admin', label: 'Tableau de bord', roles: ['admin', 'inviter', 'security'] },
  { to: '/admin/invitations', label: 'Invitations', roles: ['admin', 'inviter'] },
  { to: '/admin/checkin', label: 'Accueil des invités', roles: ['admin', 'security'] },
  { to: '/admin/thanks', label: 'Remerciements', roles: ['admin'] },
  { to: '/admin/events', label: 'Programme', roles: ['admin'] },
  { to: '/admin/users', label: 'Équipe', roles: ['admin'] },
  { to: '/admin/settings', label: 'Thème et paramètres', roles: ['admin'] },
];

export const ROLE_LABEL: Record<Role, string> = {
  pending: 'En attente',
  admin: 'Administrateur',
  inviter: 'Inviteur',
  security: 'Sécurité',
};

export default function AdminLayout() {
  const { session, profile, loading, signOut } = useAuth();
  const { settings } = useSettings();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // Ferme le menu mobile à chaque changement de page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>('a')?.focus();
    const btn = menuBtn.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      btn?.focus();
    };
  }, [menuOpen]);

  if (loading) return <div className="admin-loading">Chargement…</div>;
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!profile || profile.role === 'pending') {
    return (
      <div className="auth">
        <div className="auth__card">
          <h1>Compte en attente</h1>
          <p>
            Votre compte est créé. L’administrateur doit maintenant l’activer et vous attribuer un rôle : inviteur ou
            sécurité. Revenez sur cette page une fois prévenu.
          </p>
          <button className="btn btn--ghost" onClick={signOut}>Se déconnecter</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin ${menuOpen ? 'is-menu-open' : ''}`}>
      <aside className="admin__side">
        <div className="admin__bar">
          <strong className="admin__title">{settings?.couple_names || 'Mariage'}</strong>
          <button
            ref={menuBtn}
            type="button"
            className="admin__menu-btn"
            aria-expanded={menuOpen}
            aria-controls="admin-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="admin__burger" aria-hidden="true" />
            Menu
          </button>
        </div>
        <div className="admin__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        <div id="admin-nav" ref={drawer} className="admin__drawer">
          <div className="admin__brand">
            <strong>{settings?.couple_names || 'Mariage'}</strong>
            <span>{profile.full_name || profile.email} · {ROLE_LABEL[profile.role]}</span>
          </div>
          <nav className="admin__nav" aria-label="Navigation">
            {NAV.filter((n) => n.roles.includes(profile.role)).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/admin'} onClick={() => setMenuOpen(false)}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button className="btn btn--ghost admin__logout" onClick={signOut}>Se déconnecter</button>
        </div>
      </aside>
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
