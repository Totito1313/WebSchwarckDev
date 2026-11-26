// Cargadores, inspirados en el «Loader» y el «Text Shimmer» de HeroUI Pro y hechos
// solo con CSS (pro.css): clásico, puntos, pulso, escáner, rejilla, forma y hélice.
// Con «reducir movimiento» del sistema se quedan quietos.

const PARTS = { classic: 0, dots: 3, pulse: 2, scan: 1, grid: 9, morph: 1, helix: 5 };
export const LOADERS = Object.keys(PARTS);

/** variant: classic | dots | pulse | scan | grid | morph | helix; size: sm | md | lg */
export function Loader({ variant = 'classic', size = 'md', label = 'Cargando', className = '', color }) {
  const n = PARTS[variant] ?? 0;
  return (
    <span
      role="status"
      aria-label={label}
      className={`sw-loader sw-loader--${variant} ${size !== 'md' ? `sw-loader--${size}` : ''} ${className}`}
      style={color ? { color } : undefined}
    >
      {Array.from({ length: n }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

/** Texto con un brillo que lo recorre, para «Pensando…» o «Cargando tus datos…». */
export function ShimmerText({ children, className = '' }) {
  return <span className={`sw-shimmer ${className}`}>{children}</span>;
}

/** Pantalla de carga centrada: el cargador y una línea de texto. */
export function LoadingScreen({ text = 'Cargando…', variant = 'dots' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader variant={variant} size="lg" label={text} />
      <ShimmerText className="text-sm font-medium">{text}</ShimmerText>
    </div>
  );
}
