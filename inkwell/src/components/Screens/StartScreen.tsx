import { FC, useState } from 'react';
import { Plus, FolderOpen, Notebook, Clock, Sparkles, Trash2 } from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import { CreateNotebookDialog } from './CreateNotebookDialog';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { importNotebookBundle } from '../../utils/bundle';

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
  const notebooks = useNotesStore((state) => state.notebooks);
  const createNotebook = useNotesStore((state) => state.createNotebook);
  const deleteNotebook = useNotesStore((state) => state.deleteNotebook);
  const setActiveNotebook = useNotesStore((state) => state.setActiveNotebook);

  const handleOpenExisting = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'Inkwell Notebook', extensions: ['inkwell.json', 'json'] }],
      });
      if (selected && typeof selected === 'string') {
        const imported = await importNotebookBundle(selected);
        useNotesStore.setState((state) => ({
          notebooks: [imported, ...state.notebooks.filter((nb) => nb.id !== imported.id)],
          activeNotebookId: imported.id,
          activeSectionId: imported.sections[0]?.id ?? null,
        }));
      }
    } catch (err) {
      console.warn('Native dialog open failed, falling back to browser picker:', err);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.inkwell.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const imported = await importNotebookBundle(file);
            useNotesStore.setState((state) => ({
              notebooks: [imported, ...state.notebooks.filter((nb) => nb.id !== imported.id)],
              activeNotebookId: imported.id,
              activeSectionId: imported.sections[0]?.id ?? null,
            }));
          } catch (importErr) {
            console.error('Failed to import bundle:', importErr);
            alert('Failed to parse notebook bundle.');
          }
        }
      };
      input.click();
    }
  };

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
            <div className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-md">
              <Sparkles size={18} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 leading-none">
                Inkwell
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

          {/* Card 2: Existing notebook */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenExisting}
            className="h-[210px] rounded-2xl bg-white/90 dark:bg-[#262626] hover:bg-white dark:hover:bg-[#2F2F2F] border border-black/[0.08] dark:border-white/[0.1] hover:border-black/30 dark:hover:border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer group no-drag hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-800 dark:bg-[#383838] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
              <FolderOpen size={22} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                Open Existing
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Import an .inkwell.json file
              </p>
            </div>
          </div>

          {/* Cards 3...n: Recent notebooks or placeholder */}
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({ id: nb.id, name: nb.name });
                      }}
                      title="Delete Notebook"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
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
        onCreate={(name, folderPath) => createNotebook(name, folderPath)}
      />

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
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
