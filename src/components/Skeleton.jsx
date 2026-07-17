/**
 * Skeletons de carga.
 *
 * Se usan al **cargar datos** de una vista: muestran la forma del contenido, así
 * la espera se percibe más corta y no hay salto de layout cuando llegan los datos.
 * Para **acciones** que deben bloquear la pantalla (guardar), usar un overlay.
 *
 * Respetan `prefers-reduced-motion`: sin el barrido, queda el fondo gris estático.
 */

/** Bloque gris con barrido de brillo. Se le pasa el tamaño por className. */
export function Skeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-gray-200/80 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:animate-none" />
    </div>
  );
}

/** Contenedor accesible: anuncia la carga sin spamear al lector de pantalla. */
function Loading({ label, children }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Tarjetas KPI + gráficas: para el tablero. */
export function DashboardSkeleton() {
  return (
    <Loading label="Cargando tablero">
      <div className="max-w-[1280px] mx-auto space-y-5">
        {/* KPIs */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 lg:p-5 shadow-sm">
          <Skeleton className="h-3 w-32 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                <Skeleton className="h-2.5 w-16 mb-2" />
                <Skeleton className="h-6 w-12 mb-2" />
                <Skeleton className="h-2 w-20" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                <Skeleton className="h-2.5 w-20 mb-2" />
                <Skeleton className="h-6 w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* Gráfica ancha */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 lg:p-5 shadow-sm">
          <Skeleton className="h-3 w-28 mb-4" />
          <Skeleton className="h-[220px] w-full" />
        </div>

        {/* Dos gráficas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 lg:p-5 shadow-sm">
              <Skeleton className="h-3 w-36 mb-4" />
              <Skeleton className="h-[220px] w-full" />
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}

/** Filas tipo tarjeta: para el monitor de llamadas. */
export function CallListSkeleton({ rows = 5 }) {
  return (
    <Loading label="Cargando llamadas">
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div>
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-28 mb-2" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
              <div>
                <Skeleton className="h-2.5 w-14 mb-1.5" />
                <Skeleton className="h-3.5 w-10" />
              </div>
              <div>
                <Skeleton className="h-2.5 w-16 mb-1.5" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Filas de tabla genéricas: usuarios, proyectos, contactos. */
export function TableSkeleton({ rows = 6, cols = 5, label = 'Cargando datos' }) {
  return (
    <Loading label={label}>
      <div className="overflow-hidden">
        <div className="flex gap-4 pb-2 border-b border-gray-200">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 py-3.5 border-b border-gray-100">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Rejilla de tarjetas: para campañas. */
export function CardGridSkeleton({ cards = 6, label = 'Cargando' }) {
  return (
    <Loading label={label}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full mb-3 rounded-full" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}
