import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../lib/types';

export default function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) {
    return (
      <div className="panel">
        <h2>Accès réservé</h2>
        <p>Votre compte n’a pas accès à cette page. Demandez à l’administrateur de modifier votre rôle.</p>
      </div>
    );
  }
  return <>{children}</>;
}
