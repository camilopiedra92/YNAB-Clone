'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useImportBudgetMutation, type ImportStats } from '@/hooks/useImportMutations';
import { useTranslations } from 'next-intl';
import Modal from './ui/Modal';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ImportState = 'idle' | 'uploading' | 'success' | 'error';



export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
    const params = useParams();
    const budgetId = params.budgetId as string;
    const t = useTranslations('import');
    const tc = useTranslations('common');

    const [registerFile, setRegisterFile] = useState<File | null>(null);
    const [planFile, setPlanFile] = useState<File | null>(null);
    const [state, setState] = useState<ImportState>('idle');
    const [error, setError] = useState<string>('');
    const [stats, setStats] = useState<ImportStats | null>(null);

    const { mutateAsync: importBudget, isPending: _isUploading } = useImportBudgetMutation();

    const handleClose = useCallback(() => {
        if (state === 'uploading') return; // Don't close while uploading
        setRegisterFile(null);
        setPlanFile(null);
        setState('idle');
        setError('');
        setStats(null);
        onClose();
    }, [state, onClose]);

    const handleImport = async () => {
        if (!registerFile || !planFile) return;

        setState('uploading');
        setError('');

        try {
            const result = await importBudget({ budgetId, registerFile, planFile });

            setStats(result.stats);
            setState('success');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
            setState('error');
        }
    };



    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={t('title')} size="md">
            <div className="space-y-6 pb-4">
                {state === 'success' && stats ? (
                    <div className="text-center space-y-4 py-4" data-testid="import-success">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-green-500/10 border border-green-500/20">
                            <CheckCircle2 className="w-9 h-9 text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-200">
                            {t('success')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-left">
                            {[
                                [t('accounts'), stats.accounts],
                                [t('groups'), stats.categoryGroups],
                                [t('transactions'), stats.transactions],
                                [t('transfers'), stats.transfers],
                                [t('budgetEntries'), stats.budgetEntries],
                            ].map(([label, value]) => (
                                <div key={label as string} className="flex justify-between items-center px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                                    <span className="text-xs text-gray-500">{label}</span>
                                    <span className="text-sm font-bold text-gray-200 tabular-nums">{value as number}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleClose}
                            data-testid="import-close-button"
                            className="mt-4 px-8 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
                        >
                            {tc('close')}
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {t('descriptionPlain')}
                        </p>

                        {state === 'error' && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                                <p className="text-sm text-red-400 font-medium">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FileDropZone
                                label={t('registerCsvLabel')}
                                file={registerFile}
                                onFileChange={setRegisterFile}
                                testId="import-register-file"
                                disabled={state === 'uploading'}
                                selectText={t('selectCsv')}
                            />
                            <FileDropZone
                                label={t('planCsvLabel')}
                                file={planFile}
                                onFileChange={setPlanFile}
                                testId="import-plan-file"
                                disabled={state === 'uploading'}
                                selectText={t('selectCsv')}
                            />
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={!registerFile || !planFile || state === 'uploading'}
                            data-testid="import-submit-button"
                            className="w-full py-4 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {state === 'uploading' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>{t('uploading')}</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    <span>{t('importButton')}</span>
                                </>
                            )}
                        </button>

                        <p className="text-[11px] text-gray-600 text-center italic">
                            {t('warning')}
                        </p>
                    </>
                )}
            </div>
        </Modal>
    );
}

const FileDropZone = ({
    label,
    file,
    onFileChange,
    testId,
    disabled,
    selectText,
}: {
    label: string;
    file: File | null;
    onFileChange: (f: File | null) => void;
    testId: string;
    disabled: boolean;
    selectText: string;
}) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
            {label}
        </label>
        <label
            className={`flex flex-col items-center justify-center p-6 rounded-xl cursor-pointer transition-all duration-300 border ${file
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                }`}
        >
            <input
                type="file"
                accept=".csv"
                className="hidden"
                data-testid={testId}
                onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    onFileChange(f);
                }}
                disabled={disabled}
            />
            {file ? (
                <>
                    <FileText className="w-8 h-8 text-green-400 mb-2" />
                    <span className="text-sm font-semibold text-green-400 truncate max-w-full">
                        {file.name}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                    </span>
                </>
            ) : (
                <>
                    <Upload className="w-8 h-8 text-gray-600 mb-2" />
                    <span className="text-sm text-gray-400">
                        {selectText}
                    </span>
                </>
            )}
        </label>
    </div>
);
