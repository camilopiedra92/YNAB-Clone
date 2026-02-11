'use client';

import { useState, useEffect, useRef } from 'react';
import { X, User, Lock, Calendar } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useUpdateProfile, useChangePassword } from '@/hooks/useProfileMutations';

interface ProfileModalProps {
    onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
    const { data: profile, isLoading } = useProfile();
    const updateProfile = useUpdateProfile();
    const changePassword = useChangePassword();

    const [name, setName] = useState(profile?.name ?? '');
    const [email, setEmail] = useState(profile?.email ?? '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const overlayRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Sync form state when profile data loads (async)
    useEffect(() => {
        if (profile) {
            setName(profile.name ?? '');
            setEmail(profile.email ?? '');
        }
    }, [profile]);

    // Focus name input on mount
    useEffect(() => {
        if (!isLoading) {
            nameInputRef.current?.focus();
        }
    }, [isLoading]);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    const handleSaveProfile = () => {
        if (!name.trim() || !email.trim()) return;
        updateProfile.mutate(
            { name: name.trim(), email: email.trim() },
            { onSuccess: () => {} }
        );
    };

    const handleChangePassword = () => {
        setPasswordError('');

        if (newPassword !== confirmPassword) {
            setPasswordError('Las contraseñas no coinciden');
            return;
        }

        changePassword.mutate(
            { currentPassword, newPassword },
            {
                onSuccess: () => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                },
                onError: (err) => {
                    setPasswordError(err.message);
                },
            }
        );
    };

    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-CO', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
    };

    const inputStyle = {
        background: 'hsl(222 35% 18%)',
        boxShadow: 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)',
    };

    const inputFocusStyle = 'inset 4px 4px 8px 0 rgba(0,0,0,0.4), inset -4px -4px 8px 0 rgba(255,255,255,0.04)';
    const inputBlurStyle = 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)';

    if (isLoading) {
        return (
            <div
                ref={overlayRef}
                className="fixed inset-0 z-[100] flex items-center justify-center"
                onClick={handleOverlayClick}
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            >
                <div className="text-white/50 text-[13px]">Cargando...</div>
            </div>
        );
    }

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={handleOverlayClick}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
            <div
                className="relative w-[480px] max-w-[90vw] max-h-[85vh] rounded-2xl overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200"
                style={{
                    background: 'hsl(222 35% 18%)',
                    boxShadow: '10px 10px 30px 0 rgba(0,0,0,0.5), -10px -10px 30px 0 rgba(255,255,255,0.03)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-[12px] font-bold text-white"
                            style={{ boxShadow: '2px 2px 5px 0 rgba(0,0,0,0.3), -2px -2px 5px 0 rgba(255,255,255,0.03)' }}
                        >
                            {profile?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <h2 className="text-[15px] font-semibold text-white/90 tracking-tight">
                            Mi Perfil
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-all duration-200"
                        style={{ boxShadow: '2px 2px 5px 0 rgba(0,0,0,0.3), -2px -2px 5px 0 rgba(255,255,255,0.02)' }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Section 1: Personal Info */}
                <div className="px-6 py-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <User className="w-3.5 h-3.5 text-primary-300/70" />
                        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.12em]">
                            Información Personal
                        </span>
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                            Nombre
                        </label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProfile(); }}
                            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none transition-all duration-200"
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.boxShadow = inputFocusStyle; }}
                            onBlur={(e) => { e.currentTarget.style.boxShadow = inputBlurStyle; }}
                            placeholder="Tu nombre..."
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProfile(); }}
                            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none transition-all duration-200"
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.boxShadow = inputFocusStyle; }}
                            onBlur={(e) => { e.currentTarget.style.boxShadow = inputBlurStyle; }}
                            placeholder="tu@email.com"
                        />
                    </div>

                    {/* Member Since */}
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-white/25">
                        <Calendar className="w-3 h-3" />
                        <span>Miembro desde {formatDate(profile?.createdAt)}</span>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={handleSaveProfile}
                            disabled={!name.trim() || !email.trim() || updateProfile.isPending}
                            className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-primary-500"
                            style={{ boxShadow: '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.03)' }}
                            onMouseEnter={(e) => {
                                if (!updateProfile.isPending && name.trim() && email.trim()) {
                                    e.currentTarget.style.boxShadow = '4px 4px 12px 0 rgba(0,0,0,0.35), -4px -4px 12px 0 rgba(255,255,255,0.04)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.03)';
                            }}
                        >
                            {updateProfile.isPending ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-6 h-px bg-white/[0.05]" />

                {/* Section 2: Change Password */}
                <div className="px-6 py-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Lock className="w-3.5 h-3.5 text-amber-300/70" />
                        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.12em]">
                            Cambiar Contraseña
                        </span>
                    </div>

                    {/* Current Password */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                            Contraseña Actual
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none transition-all duration-200"
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.boxShadow = inputFocusStyle; }}
                            onBlur={(e) => { e.currentTarget.style.boxShadow = inputBlurStyle; }}
                            placeholder="••••••••"
                        />
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                            Nueva Contraseña
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none transition-all duration-200"
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.boxShadow = inputFocusStyle; }}
                            onBlur={(e) => { e.currentTarget.style.boxShadow = inputBlurStyle; }}
                            placeholder="Mínimo 8 caracteres"
                        />
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                            Confirmar Contraseña
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
                            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none transition-all duration-200"
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.boxShadow = inputFocusStyle; }}
                            onBlur={(e) => { e.currentTarget.style.boxShadow = inputBlurStyle; }}
                            placeholder="Repetir nueva contraseña"
                        />
                    </div>

                    {/* Password Error */}
                    {passwordError && (
                        <p className="text-[11px] text-rose-400/90 font-medium">{passwordError}</p>
                    )}

                    {/* Change Password Button */}
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={handleChangePassword}
                            disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
                            className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                background: 'hsl(35 80% 50%)',
                                boxShadow: '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.03)',
                            }}
                            onMouseEnter={(e) => {
                                if (!changePassword.isPending && currentPassword && newPassword && confirmPassword) {
                                    e.currentTarget.style.boxShadow = '4px 4px 12px 0 rgba(0,0,0,0.35), -4px -4px 12px 0 rgba(255,255,255,0.04)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.03)';
                            }}
                        >
                            {changePassword.isPending ? 'Cambiando...' : 'Cambiar Contraseña'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
