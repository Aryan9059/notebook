import { create } from 'zustand';
import { ToolMode, UiState } from '../types';

interface UiStore extends UiState {
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  clearSelection: () => void;
  setEditingId: (id: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  setIsImporting: (isImporting: boolean) => void;
  setImportProgress: (progress: { done: number; total: number } | null) => void;
  setActiveTool: (tool: ToolMode) => void;
  resetUi: () => void;
}

const initialState: UiState = {
  selectedId: null,
  selectedIds: [],
  editingId: null,
  isSidebarOpen: true,
  isImporting: false,
  importProgress: null,
  activeTool: 'select',
};

export const useUiStore = create<UiStore>((set) => ({
  ...initialState,
  setSelectedId: (id) =>
    set({
      selectedId: id,
      selectedIds: id ? [id] : [],
    }),
  setSelectedIds: (ids) =>
    set({
      selectedIds: ids,
      selectedId: null,
    }),
  toggleSelectedId: (id) =>
    set((state) => {
      const exists = state.selectedIds.includes(id);
      const nextIds = exists
        ? state.selectedIds.filter((item) => item !== id)
        : [...state.selectedIds, id];
      return {
        selectedIds: nextIds,
        selectedId: nextIds.length > 0 ? nextIds[nextIds.length - 1] : null,
      };
    }),
  clearSelection: () =>
    set({
      selectedId: null,
      selectedIds: [],
    }),
  setEditingId: (id) => set({ editingId: id }),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setIsImporting: (isImporting) => set({ isImporting }),
  setImportProgress: (importProgress) => set({ importProgress }),
  setActiveTool: (activeTool) => set({ activeTool }),
  resetUi: () => set(initialState),
}));

