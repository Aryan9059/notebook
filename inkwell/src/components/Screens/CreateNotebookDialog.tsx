import { useState, useEffect, type FC, type FormEvent, type KeyboardEvent } from 'react';
import { BookOpen, Folder, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

interface CreateNotebookDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, folderPath?: string) => void;
}

export const CreateNotebookDialog: FC<CreateNotebookDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [folderPath, setFolderPath] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setFolderPath('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChooseFolder = async () => {
    try {
      // @ts-expect-error — Tauri check
      const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
      if (isTauri) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Destination Folder for Notebook',
        });
        if (selected && typeof selected === 'string') {
          setFolderPath(selected);
        }
      } else {
        const dummy = prompt('Enter destination directory path:', folderPath || '~/Documents/Inkwell');
        if (dummy) setFolderPath(dummy);
      }
    } catch (err) {
      console.error('Failed to open folder picker:', err);
    }
  };

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onCreate(trimmed, folderPath);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-3xl bg-white/95 dark:bg-[#262626]/98 backdrop-blur-2xl border border-black/[0.08] dark:border-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] p-7 flex flex-col no-drag transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-md">
              <BookOpen size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                New Notebook
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Configure your infinite workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Fields */}
        <div className="space-y-4 mb-8">
          {/* Title */}
          <div>
            <label
              htmlFor="notebook-name-input"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
            >
              Notebook Title
            </label>
            <input
              id="notebook-name-input"
              type="text"
              autoFocus
              placeholder="e.g. Research, Architecture, Notes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-11 rounded-xl bg-gray-100/90 dark:bg-[#1E1E1E] focus:bg-white dark:focus:bg-[#1E1E1E] border border-black/[0.06] dark:border-white/10 focus:border-black dark:focus:border-white px-4 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all outline-none"
            />
          </div>

          {/* Folder Destination Picker */}
          <div>
            <label
              htmlFor="notebook-folder-input"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
            >
              Storage Location
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-11 rounded-xl bg-gray-100/90 dark:bg-[#1E1E1E] border border-black/[0.06] dark:border-white/10 px-3.5 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 truncate select-text">
                <Folder size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
                <span className="truncate">
                  {folderPath || 'Default (App Storage)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleChooseFolder}
                className="h-11 px-4 rounded-xl bg-gray-200/80 dark:bg-[#333333] hover:bg-gray-300/80 dark:hover:bg-[#3E3E3E] text-gray-800 dark:text-gray-200 text-xs font-medium transition cursor-pointer shrink-0"
              >
                Browse…
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
              Choose a folder on disk to store this notebook, or use the default location.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => handleSubmit()}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            Create Notebook
          </button>
        </div>
      </div>
    </div>
  );
};

