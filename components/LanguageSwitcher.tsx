'use client';

import { useLocale } from 'next-intl';
import { useUpdateLocale } from '@/hooks/useProfileMutations';

const LOCALES = [
    { code: 'en', label: 'EN' },
    { code: 'es', label: 'ES' },
] as const;

/**
 * LanguageSwitcher — Compact EN/ES pill toggle with a sliding indicator.
 * Lives in the Sidebar top area, always visible on every authenticated page.
 */
export default function LanguageSwitcher() {
    const currentLocale = useLocale();
    const updateLocale = useUpdateLocale();
    const activeIndex = currentLocale === 'en' ? 0 : 1;

    return (
        <div
            data-testid="language-switcher"
            className="flex items-center justify-center"
        >
            <div
                className="relative flex items-center rounded-full p-[3px]"
                style={{
                    background: 'hsl(222 35% 22%)',
                    boxShadow:
                        'inset 2px 2px 5px 0 rgba(0,0,0,0.35), inset -2px -2px 5px 0 rgba(255,255,255,0.03)',
                }}
            >
                {/* Sliding indicator */}
                <div
                    className="absolute top-[3px] bottom-[3px] rounded-full transition-all duration-300 ease-out"
                    style={{
                        width: 'calc(50% - 3px)',
                        left: activeIndex === 0 ? '3px' : 'calc(50%)',
                        background: 'hsl(216 45% 58%)',
                        boxShadow:
                            '2px 2px 6px 0 rgba(0,0,0,0.3), -2px -2px 6px 0 rgba(255,255,255,0.03)',
                    }}
                />

                {LOCALES.map((loc) => {
                    const isActive = loc.code === currentLocale;
                    return (
                        <button
                            key={loc.code}
                            onClick={() => {
                                if (!isActive) updateLocale.mutate(loc.code);
                            }}
                            disabled={updateLocale.isPending}
                            data-testid={`locale-${loc.code}`}
                            className={`relative z-10 px-3 py-1 rounded-full text-[10px] font-black tracking-wider transition-colors duration-300 ${
                                isActive
                                    ? 'text-white'
                                    : 'text-white/35 hover:text-white/60'
                            } ${updateLocale.isPending ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                        >
                            {loc.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
