import { FC, useState, useEffect } from 'react';
import { Plus, Notebook, Clock, Trash2, MoreHorizontal, Pencil } from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import { CreateNotebookDialog } from './CreateNotebookDialog';
import { ConfirmDialog } from '../Common/ConfirmDialog';

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffDays === 0) {
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${diffHr}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const StartScreen: FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingNotebook, setRenamingNotebook] = useState<{ id: string; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const notebooks = useNotesStore((state) => state.notebooks);
  const createNotebook = useNotesStore((state) => state.createNotebook);
  const deleteNotebook = useNotesStore((state) => state.deleteNotebook);
  const renameNotebook = useNotesStore((state) => state.renameNotebook);
  const setActiveNotebook = useNotesStore((state) => state.setActiveNotebook);

  useEffect(() => {
    const handleCloseMenu = () => setOpenMenuId(null);
    if (openMenuId) {
      window.addEventListener('click', handleCloseMenu);
    }
    return () => window.removeEventListener('click', handleCloseMenu);
  }, [openMenuId]);

  const recentNotebooks = [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="w-full h-full bg-[#F8F9FA] dark:bg-[#212121] select-none overflow-y-auto flex flex-col transition-colors">
      {/* Titlebar drag region for macOS */}
      <div className="fixed top-0 left-0 right-0 h-9 drag-region z-30 pointer-events-none" />

      {/* Main container with generous padding */}
      <div className="titlebar-pad px-14 pt-8 pb-16 max-w-7xl w-full mx-auto flex flex-col flex-1">
        {/* Header Branding */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Notebook"
              className="w-9 h-9 rounded-xl object-contain shadow-md shrink-0"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 leading-none">
                Notebook
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Infinite-Canvas Workspace</p>
            </div>
          </div>
        </div>

        {/* Section Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Notebooks
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Create a new notebook or pick up where you left off
          </p>
        </div>

        {/* Row / Grid of cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {/* Card 1: New Notebook */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsCreateOpen(true)}
            className="h-[210px] rounded-2xl bg-white/90 dark:bg-[#262626] hover:bg-white dark:hover:bg-[#2F2F2F] border border-black/[0.08] dark:border-white/[0.1] hover:border-black/30 dark:hover:border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer group no-drag hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                New Notebook
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Start with a blank infinite canvas
              </p>
            </div>
          </div>

          {/* Cards 2...n: Recent notebooks or placeholder */}
          {recentNotebooks.length === 0 ? (
            <div className="h-[210px] rounded-2xl border-2 border-dashed border-gray-200/90 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center select-none no-drag">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#2A2A2A] text-gray-400 flex items-center justify-center mb-2.5">
                <Notebook size={20} />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">No recent notebooks</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Created notebooks will appear here</p>
            </div>
          ) : (
            recentNotebooks.map((nb) => (
              <div
                key={nb.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveNotebook(nb.id)}
                className="h-[210px] rounded-2xl bg-white/90 dark:bg-[#262626] hover:bg-white dark:hover:bg-[#2F2F2F] border border-black/[0.08] dark:border-white/[0.1] hover:border-black/[0.2] dark:hover:border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer group no-drag hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#333333] text-gray-700 dark:text-gray-300 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-[#3D3D3D] transition-colors">
                    <Notebook size={20} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-gray-100/90 dark:bg-white/[0.08] text-[11px] font-medium text-gray-600 dark:text-gray-300">
                      {nb.sections.length} {nb.sections.length === 1 ? 'section' : 'sections'}
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === nb.id ? null : nb.id);
                        }}
                        title="Notebook options"
                        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition cursor-pointer"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {openMenuId === nb.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-white/95 dark:bg-[#262626]/98 backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)] border border-black/10 dark:border-white/10 p-1 z-50 animate-fade-in no-drag"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setRenamingNotebook({ id: nb.id, name: nb.name });
                              setRenameInput(nb.name);
                            }}
                            className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-gray-800 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Pencil size={13} className="text-gray-500 dark:text-gray-400" />
                            <span>Rename notebook</span>
                          </button>
                          <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setConfirmDelete({ id: nb.id, name: nb.name });
                            }}
                            className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Trash2 size={13} />
                            <span>Delete notebook</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                    {nb.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                    <Clock size={12} className="shrink-0" />
                    <span>Updated {formatRelativeDate(nb.updatedAt)}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <CreateNotebookDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={(name) => createNotebook(name)}
      />

      {/* Rename Notebook Dialog */}
      {renamingNotebook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md animate-fade-in p-4"
          onClick={() => setRenamingNotebook(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-3xl bg-white/95 dark:bg-[#262626]/98 backdrop-blur-2xl border border-black/[0.08] dark:border-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] p-6 flex flex-col no-drag"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Rename Notebook
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Enter a new name for your notebook.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = renameInput.trim();
                if (trimmed && renamingNotebook) {
                  renameNotebook(renamingNotebook.id, trimmed);
                  setRenamingNotebook(null);
                }
              }}
            >
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 mb-5"
                placeholder="Notebook name"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingNotebook(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting Notebook from Start Screen */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Delete Notebook"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? All sections, canvas notes, and imagery will be permanently removed.`}
        confirmLabel="Delete Notebook"
        isDestructive={true}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteNotebook(confirmDelete.id);
            setConfirmDelete(null);
            window.dispatchEvent(
              new CustomEvent('inkwell-toast', { detail: 'Notebook deleted' })
            );
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
