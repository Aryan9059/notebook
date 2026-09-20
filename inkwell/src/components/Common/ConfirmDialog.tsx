import { type FC, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md animate-fade-in p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)] p-5 flex flex-col no-drag"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <AlertTriangle size={20} strokeWidth={2} />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-semibold text-gray-900 tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer shrink-0 -mr-1 -mt-1"
          >
            <X size={15} />
          </button>
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-black/[0.06]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-gray-700 hover:bg-black/[0.05] transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                : 'bg-black hover:bg-gray-800 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
