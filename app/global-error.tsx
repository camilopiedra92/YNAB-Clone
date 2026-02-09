'use client';

/**
 * Global error boundary — replaces the root layout on uncaught errors.
 * Must define its own <html> and <body> tags since no layout is rendered.
 * 
 * This file is intentionally minimal to avoid pulling in any browser-only
 * dependencies (like idb-keyval) during production build prerendering.
 */
export default function GlobalError({
    error: _error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="es">
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    fontFamily: 'system-ui, sans-serif',
                    padding: '2rem',
                    textAlign: 'center',
                }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                        Algo salió mal
                    </h2>
                    <p style={{ color: '#666', marginBottom: '1.5rem', maxWidth: '400px' }}>
                        Ocurrió un error inesperado. Intenta recargar la página.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                        }}
                    >
                        Intentar de nuevo
                    </button>
                </div>
            </body>
        </html>
    );
}
