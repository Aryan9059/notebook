import { useState, useEffect, type FC, type FormEvent, type KeyboardEvent } from 'react';
import { BookOpen, X } from 'lucide-react';

interface CreateNotebookDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const CreateNotebookDialog: FC<CreateNotebookDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onCreate(trimmed);
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/70 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.2)] p-7 flex flex-col no-drag"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <BookOpen size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                New Notebook
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Name your infinite workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Field */}
        <div className="mb-8">
          <label
            htmlFor="notebook-name-input"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2"
          >
            Notebook Title
          </label>
          <input
            id="notebook-name-input"
            type="text"
            autoFocus
            placeholder="e.g. Research, Architecture, Lecture Notes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-12 rounded-xl bg-gray-100/90 focus:bg-white border border-transparent focus:border-blue-500 px-4 text-base text-gray-900 focus:ring-4 focus:ring-blue-500/15 transition-all outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => handleSubmit()}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-sm shadow-blue-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Notebook
          </button>
        </div>
      </div>
    </div>
  );
};
