'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, Clock, Edit3 } from 'lucide-react';
import { InspectorData } from '@/hooks/useBudget';

interface BudgetInspectorProps {
    data: InspectorData | null;
    currentMonth: string;
    formatCurrency: (amount: number) => string;
}

function getMonthLabel(monthStr: string): string {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('es-CO', { month: 'long' });
}

function getMonthWithYear(monthStr: string): string {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1);
    const label = date.toLocaleDateString('es-CO', { month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1) + ' ' + year;
}

function getYearFromMonth(monthStr: string): string {
    return monthStr.split('-')[0];
}

function getMonthLabelCapitalized(monthStr: string): string {
    const label = getMonthLabel(monthStr);
    return label.charAt(0).toUpperCase() + label.slice(1);
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
        <div className="bg-background rounded-2xl shadow-neu-sm overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-primary/5 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-[13px] font-bold text-foreground tracking-tight">{title}</span>
                    {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                    )}
                </div>
                {rightContent && (
                    <span className="text-[13px] font-bold text-foreground tabular-nums">
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
                className="w-full flex items-center justify-between py-2 hover:bg-primary/5 rounded-lg transition-colors -mx-1 px-1"
            >
                <div className="flex items-center gap-1.5">
                    {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                    ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                    )}
                    <span className="text-[12px] font-semibold text-muted-foreground/70 uppercase tracking-wider">{year}</span>
                </div>
                <span className="text-[12px] font-semibold tabular-nums text-muted-foreground/70">{subtotal}</span>
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
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer group ${variant === 'primary'
            ? 'shadow-neu-sm hover:shadow-neu-md'
            : 'shadow-neu-sm hover:shadow-neu-md'
            }`}>
            <span className="text-[13px] font-medium text-primary group-hover:text-primary/80">{label}</span>
            <span className={`text-[13px] font-bold tabular-nums ${variant === 'primary' ? 'text-primary' : 'text-foreground'
                }`}>
                {value}
            </span>
        </div>
    );
}

export function BudgetInspector({ data, currentMonth, formatCurrency }: BudgetInspectorProps) {
    if (!data) {
        return (
            <div className="w-[310px] min-w-[310px] p-4 space-y-4">
                <div className="bg-background rounded-2xl shadow-neu-sm p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                </div>
            </div>
        );
    }

    const monthLabel = getMonthLabelCapitalized(currentMonth);

    return (
        <div className="w-[310px] min-w-[310px] p-3 space-y-3"
        >
            {/* ── Month Summary ── */}
            <CollapsibleSection
                title={`${monthLabel}'s Summary`}
                defaultExpanded={true}
            >
                <div className="px-5 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-muted-foreground">Left Over from Last Month</span>
                        <span className="text-[13px] font-semibold tabular-nums text-foreground ml-4">{formatCurrency(data.summary.leftOverFromLastMonth)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-muted-foreground">Assigned in {monthLabel}</span>
                        <span className="text-[13px] font-semibold tabular-nums text-foreground ml-4">{formatCurrency(data.summary.assignedThisMonth)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-muted-foreground">Activity</span>
                        <span className={`text-[13px] font-semibold tabular-nums ml-4 ${data.summary.activity < 0 ? 'text-foreground' : 'text-foreground'}`}>
                            {formatCurrency(data.summary.activity)}
                        </span>
                    </div>
                    <div className="border-t border-border/30 my-2" />
                    <div className="flex justify-between items-baseline">
                        <span className="text-[13px] font-semibold text-foreground">Available</span>
                        <span className="text-[13px] font-bold tabular-nums text-foreground ml-4">{formatCurrency(data.summary.available)}</span>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ── Cost to Be Me ── */}
            <div className="bg-background rounded-2xl shadow-neu-sm overflow-hidden px-5 py-4">
                <h3 className="text-[13px] font-bold text-foreground tracking-tight mb-3">Cost to Be Me</h3>

                {/* Targets Row */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] text-muted-foreground">{monthLabel}&apos;s Targets</span>
                        <span className="text-[13px] font-bold tabular-nums text-foreground">
                            {formatCurrency(data.costToBeMe.targets)}
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Expected Income */}
                <div className="space-y-1.5 mt-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] text-muted-foreground">Expected Income</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-bold tabular-nums text-foreground">
                                {formatCurrency(data.costToBeMe.expectedIncome)}
                            </span>
                            <Edit3 className="w-3 h-3 text-muted-foreground/40" />
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: '100%' }} />
                    </div>
                </div>
            </div>

            {/* ── Auto-Assign ── */}
            <CollapsibleSection
                title="Auto-Assign"
                icon={<Zap className="w-4 h-4 text-primary" />}
                defaultExpanded={true}
            >
                <div className="px-3 space-y-1.5">
                    {/* Primary auto-assign option */}
                    <AutoAssignItem
                        label="Underfunded"
                        value={formatCurrency(data.autoAssign.underfunded)}
                        variant="primary"
                    />

                    <div className="mx-2 border-t border-border/20 my-1" />

                    {/* Secondary options */}
                    <AutoAssignItem label="Assigned Last Month" value={formatCurrency(data.autoAssign.assignedLastMonth)} />
                    <AutoAssignItem label="Spent Last Month" value={formatCurrency(data.autoAssign.spentLastMonth)} />
                    <AutoAssignItem label="Average Assigned" value={formatCurrency(data.autoAssign.averageAssigned)} />
                    <AutoAssignItem label="Average Spent" value={formatCurrency(data.autoAssign.averageSpent)} />

                    <div className="mx-2 border-t border-border/20 my-1" />

                    {/* Tertiary options */}
                    <AutoAssignItem label="Reduce Overfunding" value={formatCurrency(data.autoAssign.reduceOverfunding)} />
                    <AutoAssignItem label="Reset Available Amounts" value={formatCurrency(data.autoAssign.resetAvailableAmounts)} />
                    <AutoAssignItem label="Reset Assigned Amounts" value={formatCurrency(data.autoAssign.resetAssignedAmounts)} />
                </div>
            </CollapsibleSection>

            {/* ── Assigned in Future Months ── */}
            <CollapsibleSection
                title="Assigned in Future Months"
                defaultExpanded={true}
                rightContent={formatCurrency(data.futureAssignments.total)}
            >
                <div className="px-5 space-y-0.5">
                    {data.futureAssignments.months.length === 0 ? (
                        <div className="py-1">
                            <span className="text-[13px] text-muted-foreground/50 italic">No future assignments</span>
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
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
                                            <span className="text-[13px] text-muted-foreground">
                                                {getMonthWithYear(fm.month)}
                                            </span>
                                        </div>
                                        <span className="text-[13px] font-medium tabular-nums text-foreground">
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
                                                <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
                                                <span className="text-[13px] text-muted-foreground">
                                                    {getMonthLabelCapitalized(fm.month)}
                                                </span>
                                            </div>
                                            <span className="text-[13px] font-medium tabular-nums text-foreground">
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
