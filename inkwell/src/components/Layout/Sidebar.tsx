import {
  type FC,
  useState,
  useRef,
  useEffect,
} from 'react';
import {
  PanelLeft,
  ChevronDown,
  Plus,
  Trash2,
  BookOpen,
  Layers,
  Folder,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';
import { ConfirmDialog } from '../Common/ConfirmDialog';

interface SidebarProps {
  onNewNotebookClick?: () => void;
  onGoToStartScreen?: () => void;
}

export const Sidebar: FC<SidebarProps> = ({ onNewNotebookClick, onGoToStartScreen }) => {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const notebooks = useNotesStore((state) => state.notebooks);
  const activeNotebookId = useNotesStore((state) => state.activeNotebookId);
  const activeSectionId = useNotesStore((state) => state.activeSectionId);

  const setActiveNotebook = useNotesStore((state) => state.setActiveNotebook);
  const deleteNotebook = useNotesStore((state) => state.deleteNotebook);
  const addSection = useNotesStore((state) => state.addSection);
  const renameSection = useNotesStore((state) => state.renameSection);
  const deleteSection = useNotesStore((state) => state.deleteSection);
  const setActiveSection = useNotesStore((state) => state.setActiveSection);

  const activeNotebook = notebooks.find((nb) => nb.id === activeNotebookId);

  // Notebook switcher dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Section inline renaming state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Confirmation dialog state for deleting sections or notebooks
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'section' | 'notebook';
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (editingSectionId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingSectionId]);

  const handleStartRename = (secId: string, currentName: string) => {
    setEditingSectionId(secId);
    setEditingName(currentName);
  };

  const handleFinishRename = (secId: string) => {
    if (!activeNotebookId) return;
    const trimmed = editingName.trim();
    renameSection(activeNotebookId, secId, trimmed || 'Untitled Section');
    setEditingSectionId(null);
  };

  const handleAddSection = () => {
    if (!activeNotebookId) return;
    addSection(activeNotebookId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'section') {
      if (activeNotebookId) {
        await deleteSection(activeNotebookId, confirmDelete.id);
      }
    } else if (confirmDelete.type === 'notebook') {
      await deleteNotebook(confirmDelete.id);
      if (notebooks.length <= 1) {
        onGoToStartScreen?.();
      }
    }
    setConfirmDelete(null);
  };

  return (
    <>
      {/* Floating PanelLeft toggle button when sidebar is collapsed */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          title="Open Sidebar"
          className="absolute top-4 left-4 z-50 p-2.5 rounded-xl bg-white/90 backdrop-blur-xl border border-black/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:bg-white text-gray-700 cursor-pointer transition-all duration-150 no-drag hover:scale-105 active:scale-95"
        >
          <PanelLeft size={18} />
        </button>
      )}

      {/* Sidebar container with macOS vibrant aesthetic */}
      <aside
        className={`h-full bg-[#F5F5F7]/85 backdrop-blur-xl border-r border-black/[0.06] flex flex-col shrink-0 overflow-hidden transition-all duration-200 select-none z-30 relative ${
          isSidebarOpen ? 'w-[280px] px-3.5 pt-3' : 'w-0 px-0 pt-0 border-r-0'
        }`}
      >
        <div className="titlebar-pad w-full flex flex-col h-full">
          {/* Header row */}
          <div className="flex items-center justify-between relative mb-5 pb-3 border-b border-black/[0.06]">
            <div ref={dropdownRef} className="relative flex-1 min-w-0 mr-1.5">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-xl hover:bg-black/[0.04] transition cursor-pointer max-w-full"
              >
                <div className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
                  <BookOpen size={13} strokeWidth={2.2} />
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="font-semibold text-gray-900 text-sm truncate">
                    {activeNotebook?.name ?? 'Notebook'}
                  </span>
                  {activeNotebook?.folderPath && (
                    <span className="text-[10px] text-gray-500 truncate" title={activeNotebook.folderPath}>
                      📁 {activeNotebook.folderPath.split('/').pop() || activeNotebook.folderPath}
                    </span>
                  )}
                </div>
                <ChevronDown size={14} className="shrink-0 text-gray-400 ml-auto" />
              </button>

              {/* Apple-style Popover Menu for Notebook Switching & Management */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-white/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-black/[0.08] p-2 z-50 animate-fade-in">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Notebooks
                  </div>
                  <div className="max-h-60 overflow-y-auto my-1 space-y-0.5">
                    {notebooks.map((nb) => {
                      const isActive = nb.id === activeNotebookId;
                      return (
                        <div
                          key={nb.id}
                          onClick={() => {
                            setActiveNotebook(nb.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between group transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-black/[0.06] text-black font-semibold'
                              : 'text-gray-700 hover:bg-black/[0.03]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                            <BookOpen
                              size={14}
                              className={isActive ? 'text-black shrink-0' : 'text-gray-400 shrink-0'}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs truncate font-medium text-gray-900 leading-tight">
                                {nb.name}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate">
                                {nb.sections.length} {nb.sections.length === 1 ? 'section' : 'sections'}
                                {nb.folderPath ? ` • 📁 ${nb.folderPath.split('/').pop()}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Delete Notebook Button on Hover */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete({
                                  type: 'notebook',
                                  id: nb.id,
                                  name: nb.name,
                                });
                              }}
                              title="Delete Notebook"
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>

                            {/* Active checkmark */}
                            {isActive && (
                              <Check size={14} strokeWidth={2.5} className="text-black shrink-0 ml-0.5" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-black/[0.06] pt-1.5 mt-1.5 space-y-0.5">
                    {activeNotebook?.folderPath && (
                      <button
                        type="button"
                        onClick={async () => {
                          setIsDropdownOpen(false);
                          try {
                            const { openPath } = await import('@tauri-apps/plugin-opener');
                            await openPath(activeNotebook.folderPath!);
                          } catch (err) {
                            console.error('Failed to open folder:', err);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-gray-700 hover:bg-black/[0.04] flex items-center gap-2 cursor-pointer font-medium transition-colors"
                      >
                        <Folder size={14} className="text-gray-500" />
                        <span className="truncate">Reveal in Finder</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onNewNotebookClick?.();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-gray-700 hover:bg-black/[0.04] flex items-center gap-2 cursor-pointer font-medium transition-colors"
                    >
                      <Plus size={14} className="text-gray-500" />
                      <span>New Notebook</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onGoToStartScreen?.();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-gray-600 hover:bg-black/[0.04] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ArrowLeft size={13} className="text-gray-500" />
                      <span>All Notebooks</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle button */}
            <button
              type="button"
              onClick={toggleSidebar}
              title="Close Sidebar"
              className="p-1.5 rounded-lg hover:bg-black/[0.05] transition text-gray-500 hover:text-gray-900 cursor-pointer shrink-0"
            >
              <PanelLeft size={18} />
            </button>
          </div>

          {/* Section list label */}
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Sections
            </span>
            <span className="text-[11px] text-gray-400">
              {activeNotebook?.sections.length ?? 0}
            </span>
          </div>

          {/* Section pills */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 pb-4">
            {activeNotebook?.sections.map((sec) => {
              const isActive = sec.id === activeSectionId;
              const isRenaming = editingSectionId === sec.id;

              return (
                <div
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  onDoubleClick={() => handleStartRename(sec.id, sec.name)}
                  className={`w-full h-11 rounded-xl px-3 flex items-center justify-between text-sm transition cursor-pointer select-none group relative ${
                    isActive
                      ? 'bg-white text-gray-900 font-medium shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.04]'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-black/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-1.5">
                    <Layers
                      size={15}
                      className={isActive ? 'text-black shrink-0' : 'text-gray-400 shrink-0'}
                    />
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleFinishRename(sec.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename(sec.id);
                          if (e.key === 'Escape') setEditingSectionId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-6 bg-transparent text-gray-900 text-sm font-medium border-b border-black focus:outline-none"
                      />
                    ) : (
                      <span className="truncate">{sec.name}</span>
                    )}
                  </div>

                  {/* Delete button (if more than 1 section) */}
                  {!isRenaming && (activeNotebook.sections.length > 1) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({
                          type: 'section',
                          id: sec.id,
                          name: sec.name,
                        });
                      }}
                      title="Delete Section"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-black/10 text-gray-400 hover:text-red-600 transition cursor-pointer shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* + Add Section Button */}
            <button
              type="button"
              onClick={handleAddSection}
              className="w-full h-9 mt-2 rounded-xl border border-dashed border-gray-300/80 hover:border-gray-400 text-gray-500 hover:text-gray-800 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer select-none hover:bg-white/50"
            >
              <Plus size={14} />
              <span>Add Section</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Confirmation Dialog for Deleting Section or Notebook */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={confirmDelete?.type === 'section' ? 'Delete Section' : 'Delete Notebook'}
        message={
          confirmDelete?.type === 'section'
            ? `Are you sure you want to delete "${confirmDelete?.name}"? All notes, images, and pages in this section will be permanently deleted.`
            : `Are you sure you want to delete "${confirmDelete?.name}"? All sections, canvas notes, and imagery will be permanently removed.`
        }
        confirmLabel={confirmDelete?.type === 'section' ? 'Delete Section' : 'Delete Notebook'}
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};
