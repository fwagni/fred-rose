import { useEffect, type ReactNode } from 'react';

export default function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
