'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useImportBudgetMutation, type ImportStats } from '@/hooks/useImportMutations';
import Modal from './ui/Modal';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ImportState = 'idle' | 'uploading' | 'success' | 'error';



export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
    const params = useParams();
    const budgetId = params.budgetId as string;


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
        <Modal isOpen={isOpen} onClose={handleClose} title="Importar Datos YNAB" size="md">
            <div className="space-y-6 pb-4">
                {state === 'success' && stats ? (
                    <div className="text-center space-y-4 py-4">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                            style={{
                                boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
                            }}
                        >
                            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">
                            ¡Importación Exitosa!
                        </h3>
                        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-left">
                            {[
                                ['Cuentas', stats.accounts],
                                ['Grupos', stats.categoryGroups],
                                ['Transacciones', stats.transactions],
                                ['Transferencias', stats.transfers],
                                ['Entradas presupuesto', stats.budgetEntries],
                            ].map(([label, value]) => (
                                <div key={label as string} className="flex justify-between items-center px-3 py-2 rounded-xl"
                                    style={{
                                        boxShadow: 'inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light)',
                                    }}
                                >
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                    <span className="text-sm font-bold text-foreground tabular-nums">{value as number}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleClose}
                            className="mt-4 px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Sube los archivos CSV exportados desde YNAB. Necesitas el archivo{' '}
                            <strong>Register</strong> (transacciones) y el archivo{' '}
                            <strong>Plan</strong> (presupuesto).
                        </p>

                        {state === 'error' && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                                <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                                <p className="text-sm text-destructive font-medium">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FileDropZone
                                label="Register CSV"
                                file={registerFile}
                                onFileChange={setRegisterFile}
                                testId="import-register-file"
                                disabled={state === 'uploading'}
                            />
                            <FileDropZone
                                label="Plan CSV"
                                file={planFile}
                                onFileChange={setPlanFile}
                                testId="import-plan-file"
                                disabled={state === 'uploading'}
                            />
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={!registerFile || !planFile || state === 'uploading'}
                            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                boxShadow: registerFile && planFile
                                    ? '4px 4px 12px rgba(var(--primary), 0.3)'
                                    : 'none',
                            }}
                        >
                            {state === 'uploading' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Importando datos...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    <span>Importar Datos</span>
                                </>
                            )}
                        </button>

                        <p className="text-[11px] text-muted-foreground/60 text-center italic">
                            ⚠️ Esto reemplazará todos los datos existentes en este presupuesto.
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
}: {
    label: string;
    file: File | null;
    onFileChange: (f: File | null) => void;
    testId: string;
    disabled: boolean;
}) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
            {label}
        </label>
        <label
            className={`flex flex-col items-center justify-center p-6 rounded-2xl cursor-pointer transition-all duration-300 ${file
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'hover:bg-primary/5'
                }`}
            style={{
                boxShadow: file
                    ? 'inset 3px 3px 8px var(--neu-dark), inset -3px -3px 8px var(--neu-light)'
                    : '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
            }}
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
                    <FileText className="w-8 h-8 text-emerald-500 mb-2" />
                    <span className="text-sm font-semibold text-emerald-500 truncate max-w-full">
                        {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                    </span>
                </>
            ) : (
                <>
                    <Upload className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <span className="text-sm text-muted-foreground">
                        Click para seleccionar CSV
                    </span>
                </>
            )}
        </label>
    </div>
);
