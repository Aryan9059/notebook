import { useState, type FC } from 'react';
import { Plus, FolderOpen, BookOpen, Clock, Sparkles } from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import { CreateNotebookDialog } from './CreateNotebookDialog';
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
  const notebooks = useNotesStore((state) => state.notebooks);
  const createNotebook = useNotesStore((state) => state.createNotebook);
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

  const handleCreate = (name: string) => {
    createNotebook(name);
  };

  const recentNotebooks = [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="w-full h-full bg-[#F8F9FA] select-none overflow-y-auto flex flex-col">
      {/* Titlebar drag region for macOS */}
      <div className="fixed top-0 left-0 right-0 h-9 drag-region z-30 pointer-events-none" />

      {/* Main container with generous padding */}
      <div className="titlebar-pad px-14 pt-8 pb-16 max-w-7xl w-full mx-auto flex flex-col flex-1">
        {/* Header Branding */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-none">
                Inkwell
              </h1>
              <p className="text-xs text-gray-500 mt-1">Infinite-Canvas Workspace</p>
            </div>
          </div>
        </div>

        {/* Section Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Notebooks
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
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
            className="h-[210px] rounded-2xl bg-white/90 hover:bg-white border border-black/[0.08] hover:border-blue-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer group no-drag hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                New Notebook
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Start with a blank infinite canvas
              </p>
            </div>
          </div>

          {/* Card 2: Existing notebook */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenExisting}
            className="h-[210px] rounded-2xl bg-white/90 hover:bg-white border border-black/[0.08] hover:border-indigo-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer group no-drag hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <FolderOpen size={22} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                Open Existing
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Import an .inkwell.json file
              </p>
            </div>
          </div>

          {/* Cards 3...n: Recent notebooks or placeholder */}
          {recentNotebooks.length === 0 ? (
            <div className="h-[210px] rounded-2xl border-2 border-dashed border-gray-200/90 p-6 flex flex-col items-center justify-center text-center select-none no-drag">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-2.5">
                <BookOpen size={20} />
              </div>
              <p className="text-xs font-medium text-gray-500">No recent notebooks</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Created notebooks will appear here</p>
            </div>
          ) : (
            recentNotebooks.map((nb) => (
              <div
                key={nb.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveNotebook(nb.id)}
                className="h-[210px] rounded-2xl bg-white/90 hover:bg-white border border-black/[0.08] hover:border-black/[0.16] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer group no-drag hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <BookOpen size={20} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-gray-100/90 text-[11px] font-medium text-gray-600">
                    {nb.sections.length} {nb.sections.length === 1 ? 'section' : 'sections'}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {nb.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                    <Clock size={12} className="shrink-0" />
                    <span>Updated {formatRelativeDate(nb.updatedAt)}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateNotebookDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
};
