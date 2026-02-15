'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, Clock, Edit3 } from 'lucide-react';
import { InspectorData } from '@/hooks/useBudgetTable';
import { useFormatDate } from '@/hooks/useFormatDate';
import { useTranslations } from 'next-intl';

interface BudgetInspectorProps {
    data: InspectorData | null;
    currentMonth: string;
    formatCurrency: (amount: number) => string;
}

function getYearFromMonth(monthStr: string): string {
    return monthStr.split('-')[0];
}

interface CollapsibleSectionProps {
    title: string;
    icon?: React.ReactNode;
    defaultExpanded?: boolean;
    rightContent?: React.ReactNode;
    children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultExpanded = true, rightContent, children }: CollapsibleSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="glass-card overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.04] transition-colors group"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-[13px] font-bold text-gray-200 tracking-tight">{title}</span>
                    {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                    )}
                </div>
                {rightContent && (
                    <span className="text-[13px] font-bold text-gray-200 tabular-nums">
                        {rightContent}
                    </span>
                )}
            </button>
            {isExpanded && (
                <div className="pb-4">
                    {children}
                </div>
            )}
        </div>
    );
}

function CollapsibleYearGroup({ year, subtotal, children }: { year: string; subtotal: string; children: React.ReactNode }) {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <div>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between py-2 hover:bg-white/[0.04] rounded-lg transition-colors -mx-1 px-1"
            >
                <div className="flex items-center gap-1.5">
                    {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-gray-500" />
                    ) : (
                        <ChevronRight className="w-3 h-3 text-gray-500" />
                    )}
                    <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">{year}</span>
                </div>
                <span className="text-[12px] font-semibold tabular-nums text-gray-500">{subtotal}</span>
            </button>
            {isExpanded && (
                <div className="pl-2">
                    {children}
                </div>
            )}
        </div>
    );
}

interface AutoAssignItemProps {
    label: string;
    value: string;
    variant?: 'primary' | 'default';
}

function AutoAssignItem({ label, value, variant = 'default' }: AutoAssignItemProps) {
    return (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg transition-all cursor-pointer group ${variant === 'primary'
            ? 'bg-primary/10 border border-primary/20 hover:bg-primary/15'
            : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.06]'
            }`}>
            <span className="text-[13px] font-medium text-primary group-hover:text-primary/80">{label}</span>
            <span className={`text-[13px] font-bold tabular-nums ${variant === 'primary' ? 'text-primary' : 'text-gray-200'
                }`}>
                {value}
            </span>
        </div>
    );
}

export function BudgetInspector({ data, currentMonth, formatCurrency }: BudgetInspectorProps) {
    const t = useTranslations('inspector');
    const { formatMonth, formatMonthYear } = useFormatDate();

    if (!data) {
        return (
            <div className="w-full p-4 space-y-4">
                <div className="glass-card p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-full" />
                    <div className="h-3 bg-white/10 rounded w-5/6" />
                    <div className="h-3 bg-white/10 rounded w-2/3" />
                </div>
            </div>
        );
    }

    const monthLabel = (() => {
        const raw = formatMonth(currentMonth);
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    })();

    return (
        <div className="w-full p-3 space-y-3"
        >
            {/* ── Month Summary ── */}
            <CollapsibleSection
                title={t('monthSummary', { month: monthLabel })}
                defaultExpanded={true}
            >
                <div className="px-5 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-gray-400">{t('leftOverFromLastMonth')}</span>
                        <span className="text-[13px] font-semibold tabular-nums text-gray-200 ml-4">{formatCurrency(data.summary.leftOverFromLastMonth)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-gray-400">{t('assignedInMonth', { month: monthLabel })}</span>
                        <span className="text-[13px] font-semibold tabular-nums text-gray-200 ml-4">{formatCurrency(data.summary.assignedThisMonth)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-gray-400">{t('activity')}</span>
                        <span className="text-[13px] font-semibold tabular-nums ml-4 text-gray-200">
                            {formatCurrency(data.summary.activity)}
                        </span>
                    </div>
                    <div className="border-t border-white/10 my-2" />
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] font-semibold text-gray-200">{t('available')}</span>
                        <span className="text-lg font-bold tabular-nums text-green-400 text-glow-green ml-4">{formatCurrency(data.summary.available)}</span>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ── Cost to Be Me ── */}
            <div className="glass-card overflow-hidden px-5 py-4">
                <h3 className="text-[13px] font-bold text-gray-200 tracking-tight mb-3">{t('costToBeMe')}</h3>

                {/* Targets Row */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] text-gray-400">{t('monthTargets', { month: monthLabel })}</span>
                        <span className="text-[13px] font-bold tabular-nums text-gray-200">
                            {formatCurrency(data.costToBeMe.targets)}
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(19,127,236,0.5)]" style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Expected Income */}
                <div className="space-y-1.5 mt-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] text-gray-400">{t('expectedIncome')}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-bold tabular-nums text-gray-200">
                                {formatCurrency(data.costToBeMe.expectedIncome)}
                            </span>
                            <Edit3 className="w-3 h-3 text-gray-500" />
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(74,222,128,0.4)]" style={{ width: '100%' }} />
                    </div>
                </div>
            </div>

            {/* ── Auto-Assign ── */}
            <CollapsibleSection
                title={t('autoAssign')}
                icon={<Zap className="w-4 h-4 text-primary" />}
                defaultExpanded={true}
            >
                <div className="px-3 space-y-1.5">
                    {/* Primary auto-assign option */}
                    <AutoAssignItem
                        label={t('underfunded')}
                        value={formatCurrency(data.autoAssign.underfunded)}
                        variant="primary"
                    />

                    <div className="mx-2 border-t border-white/5 my-1" />

                    {/* Secondary options */}
                    <AutoAssignItem label={t('assignedLastMonth')} value={formatCurrency(data.autoAssign.assignedLastMonth)} />
                    <AutoAssignItem label={t('spentLastMonth')} value={formatCurrency(data.autoAssign.spentLastMonth)} />
                    <AutoAssignItem label={t('averageAssigned')} value={formatCurrency(data.autoAssign.averageAssigned)} />
                    <AutoAssignItem label={t('averageSpent')} value={formatCurrency(data.autoAssign.averageSpent)} />

                    <div className="mx-2 border-t border-white/5 my-1" />

                    {/* Tertiary options */}
                    <AutoAssignItem label={t('reduceOverfunding')} value={formatCurrency(data.autoAssign.reduceOverfunding)} />
                    <AutoAssignItem label={t('resetAvailable')} value={formatCurrency(data.autoAssign.resetAvailableAmounts)} />
                    <AutoAssignItem label={t('resetAssigned')} value={formatCurrency(data.autoAssign.resetAssignedAmounts)} />
                </div>
            </CollapsibleSection>

            {/* ── Assigned in Future Months ── */}
            <CollapsibleSection
                title={t('futureAssignments')}
                defaultExpanded={true}
                rightContent={formatCurrency(data.futureAssignments.total)}
            >
                <div className="px-5 space-y-0.5">
                    {data.futureAssignments.months.length === 0 ? (
                        <div className="py-1">
                            <span className="text-[13px] text-gray-600 italic">{t('noFutureAssignments')}</span>
                        </div>
                    ) : (
                        (() => {
                            // Group months by year
                            const grouped: { year: string; months: typeof data.futureAssignments.months; subtotal: number }[] = [];
                            let currentYear = '';
                            for (const fm of data.futureAssignments.months) {
                                const yr = getYearFromMonth(fm.month);
                                if (yr !== currentYear) {
                                    currentYear = yr;
                                    grouped.push({ year: yr, months: [], subtotal: 0 });
                                }
                                grouped[grouped.length - 1].months.push(fm);
                                grouped[grouped.length - 1].subtotal += fm.amount;
                            }

                            if (grouped.length === 1) {
                                // Single year: just show months with year in label, no sub-grouping
                                return grouped[0].months.map((fm) => (
                                    <div key={fm.month} className="flex items-center justify-between py-1.5">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-gray-600" />
                                            <span className="text-[13px] text-gray-400">
                                                {formatMonthYear(fm.month)}
                                            </span>
                                        </div>
                                        <span className="text-[13px] font-medium tabular-nums text-gray-200">
                                            {formatCurrency(fm.amount)}
                                        </span>
                                    </div>
                                ));
                            }

                            return grouped.map(({ year, months: yearMonths, subtotal }) => (
                                <CollapsibleYearGroup
                                    key={year}
                                    year={year}
                                    subtotal={formatCurrency(subtotal)}
                                >
                                    {yearMonths.map((fm) => (
                                        <div key={fm.month} className="flex items-center justify-between py-1.5">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-gray-600" />
                                                <span className="text-[13px] text-gray-400">
                                                    {(() => { const l = formatMonth(fm.month); return l.charAt(0).toUpperCase() + l.slice(1); })()}
                                                </span>
                                            </div>
                                            <span className="text-[13px] font-medium tabular-nums text-gray-200">
                                                {formatCurrency(fm.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </CollapsibleYearGroup>
                            ));
                        })()
                    )}
                </div>
            </CollapsibleSection>
        </div>
    );
}
