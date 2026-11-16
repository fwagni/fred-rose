/** Petit motif de nœud, signature visuelle du mariage. */
export function Bow({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size * 0.6} viewBox="0 0 50 30" aria-hidden="true">
      <path d="M25 15 L2 3 Q0 15 2 27 Z" fill="currentColor" />
      <path d="M25 15 L48 3 Q50 15 48 27 Z" fill="currentColor" />
      <rect x="21" y="9" width="8" height="12" rx="2" fill="var(--gold)" />
    </svg>
  );
}

/** Branche de feuillage pour le modèle « Jardin ». */
export function Leaves({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 60" aria-hidden="true">
      <path d="M5 50 Q100 0 195 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {[20, 45, 70, 95, 120, 145, 170].map((x, i) => (
        <ellipse key={x} cx={x} cy={i % 2 ? 30 : 22} rx="9" ry="4" transform={`rotate(${i % 2 ? 30 : -30} ${x} ${i % 2 ? 30 : 22})`} fill="currentColor" opacity=".7" />
      ))}
    </svg>
  );
}
