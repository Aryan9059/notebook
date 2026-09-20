import { create } from 'zustand';
import { ToolMode, UiState } from '../types';

interface UiStore extends UiState {
  setSelectedId: (id: string | null) => void;
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
  editingId: null,
  isSidebarOpen: true,
  isImporting: false,
  importProgress: null,
  activeTool: 'select',
};

export const useUiStore = create<UiStore>((set) => ({
  ...initialState,
  setSelectedId: (id) => set({ selectedId: id }),
  setEditingId: (id) => set({ editingId: id }),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setIsImporting: (isImporting) => set({ isImporting }),
  setImportProgress: (importProgress) => set({ importProgress }),
  setActiveTool: (activeTool) => set({ activeTool }),
  resetUi: () => set(initialState),
}));

