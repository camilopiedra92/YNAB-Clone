'use client';

/**
 * GlassBackground — Animated gradient blobs behind all content.
 * Creates the deep-space glassmorphic atmosphere with drifting,
 * blurred orbs in purple and blue.
 *
 * Rendered once in the app layout, fixed and pointer-events-none.
 */
export default function GlassBackground() {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
            {/* Deep navy base */}
            <div className="absolute inset-0 bg-[#0f172a]" />

            {/* Purple orb — top-left, slow pulse */}
            <div
                className="absolute w-[50%] h-[50%] rounded-full mix-blend-screen animate-blob-drift"
                style={{
                    top: '-10%',
                    left: '-10%',
                    background: 'radial-gradient(circle, rgba(126, 34, 206, 0.4) 0%, transparent 70%)',
                    filter: 'blur(120px)',
                }}
            />

            {/* Blue orb — bottom-right */}
            <div
                className="absolute w-[60%] h-[60%] rounded-full mix-blend-screen"
                style={{
                    bottom: '-10%',
                    right: '-10%',
                    background: 'radial-gradient(circle, rgba(19, 127, 236, 0.2) 0%, transparent 70%)',
                    filter: 'blur(100px)',
                    animationDelay: '3s',
                }}
            />

            {/* Teal accent orb — center-right, subtle overlay */}
            <div
                className="absolute w-[30%] h-[30%] rounded-full mix-blend-overlay animate-glow-pulse"
                style={{
                    top: '20%',
                    right: '30%',
                    background: 'radial-gradient(circle, rgba(30, 64, 175, 0.3) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
            />
        </div>
    );
}
