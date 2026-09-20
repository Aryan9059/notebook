import { type FC, useEffect } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm animate-fade-in p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[320px] rounded-2xl bg-white/95 backdrop-blur-2xl border border-black/10 shadow-[0_24px_64px_rgba(0,0,0,0.22)] p-6 flex flex-col items-center text-center no-drag transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Centered Icon Badge */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5 shadow-xs ${
            isDestructive ? 'bg-red-50 text-red-600' : 'bg-black/5 text-gray-800'
          }`}
        >
          {isDestructive ? (
            <Trash2 size={22} strokeWidth={2} />
          ) : (
            <AlertCircle size={22} strokeWidth={2} />
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 tracking-tight leading-snug">
          {title}
        </h3>

        {/* Message */}
        <p className="text-xs text-gray-500 mt-2 leading-relaxed px-1">
          {message}
        </p>

        {/* Buttons Row */}
        <div className="grid grid-cols-2 gap-2.5 mt-6 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-xl text-xs font-medium text-gray-700 bg-black/[0.05] hover:bg-black/[0.08] active:bg-black/[0.12] transition cursor-pointer flex items-center justify-center select-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 px-4 rounded-xl text-xs font-semibold text-white transition cursor-pointer flex items-center justify-center shadow-xs select-none ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-black hover:bg-gray-800 active:bg-gray-900'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

