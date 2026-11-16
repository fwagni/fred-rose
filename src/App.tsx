import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { supabaseConfigured } from './lib/supabase';
import InvitationPage from './pages/public/InvitationPage';
import HomePage from './pages/public/HomePage';
import RequireRole from './components/RequireRole';

// L'espace organisateurs est chargé à part : les invités, sur mobile, ne téléchargent que leur invitation.
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const EventsPage = lazy(() => import('./pages/admin/EventsPage'));
const InvitationsPage = lazy(() => import('./pages/admin/InvitationsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const CheckInPage = lazy(() => import('./pages/admin/CheckInPage'));
const ThanksPage = lazy(() => import('./pages/admin/ThanksPage'));

export default function App() {
  if (!supabaseConfigured) {
    return (
      <main className="setup-warning">
        <h1>Configuration requise</h1>
        <p>
          Créez le fichier <code>.env.local</code> à partir de <code>.env.example</code> et renseignez l’adresse et la clé
          publique de votre projet Supabase, puis relancez <code>npm run dev</code>.
        </p>
      </main>
    );
  }
  return (
    <Suspense fallback={<div className="admin-loading">Chargement…</div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/i/:token" element={<InvitationPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="invitations" element={<RequireRole roles={['admin', 'inviter']}><InvitationsPage /></RequireRole>} />
          <Route path="events" element={<RequireRole roles={['admin']}><EventsPage /></RequireRole>} />
          <Route path="users" element={<RequireRole roles={['admin']}><UsersPage /></RequireRole>} />
          <Route path="settings" element={<RequireRole roles={['admin']}><SettingsPage /></RequireRole>} />
          <Route path="checkin" element={<RequireRole roles={['admin', 'security']}><CheckInPage /></RequireRole>} />
          <Route path="thanks" element={<RequireRole roles={['admin']}><ThanksPage /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
