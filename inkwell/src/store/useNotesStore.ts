import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type CanvasElement,
  type Notebook,
  SCHEMA_VERSION,
  type Section,
  type Viewport,
} from '../types.ts';
import { deletePageImage } from './imageStore.ts';
import { calculateTargetZoom } from '../utils/canvasMath.ts';
import { saveNotebookToDisk } from '../utils/bundle.ts';

const MAX_UNDO_STEPS = 50;

interface NotesState {
  notebooks: Notebook[];
  activeNotebookId: string | null;
  activeSectionId: string | null;

  // In-memory undo/redo stacks (not persisted)
  undoStacks: Record<string, CanvasElement[][]>;
  redoStacks: Record<string, CanvasElement[][]>;

  // Actions
  createNotebook: (name: string, folderPath?: string) => Notebook;
  deleteNotebook: (id: string) => Promise<void>;
  setActiveNotebook: (id: string | null) => void;
  renameNotebook: (id: string, name: string) => void;

  addSection: (notebookId: string, name?: string) => Section;
  renameSection: (notebookId: string, sectionId: string, name: string) => void;
  deleteSection: (notebookId: string, sectionId: string) => Promise<void>;
  setActiveSection: (sectionId: string | null) => void;

  setViewport: (viewport: Partial<Viewport>) => void;
  resetViewport: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoomLevel: (zoom: number) => void;

  addElement: (element: CanvasElement) => void;
  addElements: (elements: CanvasElement[]) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>, commitUndo?: boolean) => void;
  moveElement: (id: string, x: number, y: number, commitUndo?: boolean) => void;
  deleteElement: (id: string) => Promise<void>;
  deleteElements: (ids: string[]) => Promise<void>;
  clearCanvas: () => Promise<void>;

  commitUndoSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Import / Export helper
  setNotebooks: (notebooks: Notebook[]) => void;
}

function cloneElements(elements: CanvasElement[]): CanvasElement[] {
  return JSON.parse(JSON.stringify(elements));
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notebooks: [],
      activeNotebookId: null,
      activeSectionId: null,
      undoStacks: {},
      redoStacks: {},

      createNotebook: (name: string, folderPath?: string) => {
        const initialSection: Section = {
          id: crypto.randomUUID(),
          name: 'Section 1',
          viewport: { x: 0, y: 0, zoom: 1 },
          elements: [],
        };

        const newNotebook: Notebook = {
          id: crypto.randomUUID(),
          name: name.trim(),
          folderPath: folderPath?.trim() || undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sections: [initialSection],
        };

        set((state) => ({
          notebooks: [newNotebook, ...state.notebooks],
          activeNotebookId: newNotebook.id,
          activeSectionId: initialSection.id,
        }));

        if (newNotebook.folderPath) {
          saveNotebookToDisk(newNotebook).catch((err) =>
            console.error('[STORAGE] Failed to save new notebook to disk:', err)
          );
        }

        return newNotebook;
      },

      deleteNotebook: async (id: string) => {
        const notebook = get().notebooks.find((nb) => nb.id === id);
        if (notebook) {
          for (const sec of notebook.sections) {
            for (const el of sec.elements) {
              if ((el.type === 'pdf-page' || el.type === 'image') && el.imageKey) {
                await deletePageImage(el.imageKey);
              }
            }
          }
        }

        set((state) => {
          const nextNotebooks = state.notebooks.filter((nb) => nb.id !== id);
          let nextActiveNotebookId = state.activeNotebookId;
          let nextActiveSectionId = state.activeSectionId;

          if (state.activeNotebookId === id) {
            if (nextNotebooks.length > 0) {
              nextActiveNotebookId = nextNotebooks[0].id;
              nextActiveSectionId = nextNotebooks[0].sections[0]?.id ?? null;
            } else {
              nextActiveNotebookId = null;
              nextActiveSectionId = null;
            }
          }

          return {
            notebooks: nextNotebooks,
            activeNotebookId: nextActiveNotebookId,
            activeSectionId: nextActiveSectionId,
          };
        });
      },

      setActiveNotebook: (id: string | null) => {
        if (!id) {
          set({ activeNotebookId: null, activeSectionId: null });
          return;
        }
        const notebook = get().notebooks.find((nb) => nb.id === id);
        set({
          activeNotebookId: id,
          activeSectionId: notebook?.sections[0]?.id ?? null,
        });
      },

      renameNotebook: (id: string, name: string) => {
        set((state) => ({
          notebooks: state.notebooks.map((nb) =>
            nb.id === id ? { ...nb, name: name.trim(), updatedAt: Date.now() } : nb
          ),
        }));
      },

      addSection: (notebookId: string, name?: string) => {
        const notebook = get().notebooks.find((nb) => nb.id === notebookId);
        const sectionName = name !== undefined ? name : `Section ${(notebook?.sections.length ?? 0) + 1}`;

        const newSection: Section = {
          id: crypto.randomUUID(),
          name: sectionName,
          viewport: { x: 0, y: 0, zoom: 1 },
          elements: [],
        };

        set((state) => ({
          notebooks: state.notebooks.map((nb) =>
            nb.id === notebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: [...nb.sections, newSection],
                }
              : nb
          ),
          activeSectionId: newSection.id,
        }));

        return newSection;
      },

      renameSection: (notebookId: string, sectionId: string, name: string) => {
        set((state) => ({
          notebooks: state.notebooks.map((nb) =>
            nb.id === notebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === sectionId ? { ...sec, name } : sec
                  ),
                }
              : nb
          ),
        }));
      },

      deleteSection: async (notebookId: string, sectionId: string) => {
        const notebook = get().notebooks.find((nb) => nb.id === notebookId);
        const section = notebook?.sections.find((s) => s.id === sectionId);
        if (section) {
          for (const el of section.elements) {
            if ((el.type === 'pdf-page' || el.type === 'image') && el.imageKey) {
              await deletePageImage(el.imageKey);
            }
          }
        }

        set((state) => {
          const nextNotebooks = state.notebooks.map((nb) => {
            if (nb.id !== notebookId) return nb;
            return {
              ...nb,
              updatedAt: Date.now(),
              sections: nb.sections.filter((s) => s.id !== sectionId),
            };
          });

          let nextActiveSectionId = state.activeSectionId;
          if (state.activeSectionId === sectionId) {
            const currentNb = nextNotebooks.find((nb) => nb.id === notebookId);
            nextActiveSectionId = currentNb?.sections[0]?.id ?? null;
          }

          return {
            notebooks: nextNotebooks,
            activeSectionId: nextActiveSectionId,
          };
        });
      },

      setActiveSection: (sectionId: string | null) => {
        set({ activeSectionId: sectionId });
      },

      setViewport: (viewport: Partial<Viewport>) => {
        const { activeNotebookId, activeSectionId } = get();
        if (!activeNotebookId || !activeSectionId) return;

        set((state) => ({
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId
                      ? { ...sec, viewport: { ...sec.viewport, ...viewport } }
                      : sec
                  ),
                }
              : nb
          ),
        }));
      },

      resetViewport: () => {
        get().setViewport({ x: 0, y: 0, zoom: 1 });
      },

      zoomIn: () => {
        const { activeNotebookId, activeSectionId, notebooks } = get();
        if (!activeNotebookId || !activeSectionId) return;
        const section = notebooks
          .find((n) => n.id === activeNotebookId)
          ?.sections.find((s) => s.id === activeSectionId);
        if (!section) return;

        const container = document.getElementById('infinite-canvas-container');
        const rect = container?.getBoundingClientRect() ?? {
          width: window.innerWidth - 280,
          height: window.innerHeight,
        };
        const next = calculateTargetZoom(
          rect.width / 2,
          rect.height / 2,
          section.viewport.zoom * 1.2,
          section.viewport
        );
        get().setViewport(next);
      },

      zoomOut: () => {
        const { activeNotebookId, activeSectionId, notebooks } = get();
        if (!activeNotebookId || !activeSectionId) return;
        const section = notebooks
          .find((n) => n.id === activeNotebookId)
          ?.sections.find((s) => s.id === activeSectionId);
        if (!section) return;

        const container = document.getElementById('infinite-canvas-container');
        const rect = container?.getBoundingClientRect() ?? {
          width: window.innerWidth - 280,
          height: window.innerHeight,
        };
        const next = calculateTargetZoom(
          rect.width / 2,
          rect.height / 2,
          section.viewport.zoom / 1.2,
          section.viewport
        );
        get().setViewport(next);
      },

      setZoomLevel: (targetZoom: number) => {
        const { activeNotebookId, activeSectionId, notebooks } = get();
        if (!activeNotebookId || !activeSectionId) return;
        const section = notebooks
          .find((n) => n.id === activeNotebookId)
          ?.sections.find((s) => s.id === activeSectionId);
        if (!section) return;

        const container = document.getElementById('infinite-canvas-container');
        const rect = container?.getBoundingClientRect() ?? {
          width: window.innerWidth - 280,
          height: window.innerHeight,
        };
        const next = calculateTargetZoom(
          rect.width / 2,
          rect.height / 2,
          targetZoom,
          section.viewport
        );
        get().setViewport(next);
      },

      addElement: (element: CanvasElement) => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks } = get();
        if (!activeNotebookId || !activeSectionId) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        const currentElements = currentSection.elements;
        const currentStack = undoStacks[activeSectionId] || [];
        const nextStack = [...currentStack, cloneElements(currentElements)].slice(-MAX_UNDO_STEPS);

        set((state) => ({
          undoStacks: { ...state.undoStacks, [activeSectionId]: nextStack },
          redoStacks: { ...state.redoStacks, [activeSectionId]: [] },
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId
                      ? { ...sec, elements: [...sec.elements, element] }
                      : sec
                  ),
                }
              : nb
          ),
        }));
      },

      addElements: (elements: CanvasElement[]) => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks } = get();
        if (!activeNotebookId || !activeSectionId || elements.length === 0) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        const currentElements = currentSection.elements;
        const currentStack = undoStacks[activeSectionId] || [];
        const nextStack = [...currentStack, cloneElements(currentElements)].slice(-MAX_UNDO_STEPS);

        set((state) => ({
          undoStacks: { ...state.undoStacks, [activeSectionId]: nextStack },
          redoStacks: { ...state.redoStacks, [activeSectionId]: [] },
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId
                      ? { ...sec, elements: [...sec.elements, ...elements] }
                      : sec
                  ),
                }
              : nb
          ),
        }));
      },

      updateElement: (id: string, patch: Partial<CanvasElement>, commitUndo = true) => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks } = get();
        if (!activeNotebookId || !activeSectionId) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        let nextUndoStacks = undoStacks;
        let nextRedoStacks = get().redoStacks;

        if (commitUndo) {
          const currentStack = undoStacks[activeSectionId] || [];
          nextUndoStacks = {
            ...undoStacks,
            [activeSectionId]: [...currentStack, cloneElements(currentSection.elements)].slice(-MAX_UNDO_STEPS),
          };
          nextRedoStacks = { ...nextRedoStacks, [activeSectionId]: [] };
        }

        set((state) => ({
          undoStacks: nextUndoStacks,
          redoStacks: nextRedoStacks,
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId
                      ? {
                          ...sec,
                          elements: sec.elements.map((el) =>
                            el.id === id ? ({ ...el, ...patch } as CanvasElement) : el
                          ),
                        }
                      : sec
                  ),
                }
              : nb
          ),
        }));
      },

      moveElement: (id: string, x: number, y: number, commitUndo = false) => {
        get().updateElement(id, { x, y } as Partial<CanvasElement>, commitUndo);
      },

      deleteElements: async (ids: string[]) => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks } = get();
        if (!activeNotebookId || !activeSectionId || ids.length === 0) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        const idSet = new Set(ids);
        for (const el of currentSection.elements) {
          if (idSet.has(el.id) && (el.type === 'pdf-page' || el.type === 'image') && el.imageKey) {
            await deletePageImage(el.imageKey);
          }
        }

        const currentStack = undoStacks[activeSectionId] || [];
        const nextStack = [...currentStack, cloneElements(currentSection.elements)].slice(-MAX_UNDO_STEPS);

        set((state) => ({
          undoStacks: { ...state.undoStacks, [activeSectionId]: nextStack },
          redoStacks: { ...state.redoStacks, [activeSectionId]: [] },
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId
                      ? {
                          ...sec,
                          elements: sec.elements.filter((el) => !idSet.has(el.id)),
                        }
                      : sec
                  ),
                }
              : nb
          ),
        }));
      },

      deleteElement: async (id: string) => {
        await get().deleteElements([id]);
      },

      clearCanvas: async () => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks } = get();
        if (!activeNotebookId || !activeSectionId) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        for (const el of currentSection.elements) {
          if ((el.type === 'pdf-page' || el.type === 'image') && el.imageKey) {
            await deletePageImage(el.imageKey);
          }
        }

        const currentStack = undoStacks[activeSectionId] || [];
        const nextStack = [...currentStack, cloneElements(currentSection.elements)].slice(-MAX_UNDO_STEPS);

        set((state) => ({
          undoStacks: { ...state.undoStacks, [activeSectionId]: nextStack },
          redoStacks: { ...state.redoStacks, [activeSectionId]: [] },
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId ? { ...sec, elements: [] } : sec
                  ),
                }
              : nb
          ),
        }));
      },

      commitUndoSnapshot: () => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks } = get();
        if (!activeNotebookId || !activeSectionId) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        const currentStack = undoStacks[activeSectionId] || [];
        const nextStack = [...currentStack, cloneElements(currentSection.elements)].slice(-MAX_UNDO_STEPS);

        set((state) => ({
          undoStacks: { ...state.undoStacks, [activeSectionId]: nextStack },
          redoStacks: { ...state.redoStacks, [activeSectionId]: [] },
        }));
      },

      undo: () => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks, redoStacks } = get();
        if (!activeNotebookId || !activeSectionId) return;

        const stack = undoStacks[activeSectionId];
        if (!stack || stack.length === 0) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        const previousElements = stack[stack.length - 1];
        const nextUndoStack = stack.slice(0, -1);

        const currentRedoStack = redoStacks[activeSectionId] || [];
        const nextRedoStack = [...currentRedoStack, cloneElements(currentSection.elements)].slice(-MAX_UNDO_STEPS);

        set((state) => ({
          undoStacks: { ...state.undoStacks, [activeSectionId]: nextUndoStack },
          redoStacks: { ...state.redoStacks, [activeSectionId]: nextRedoStack },
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId
                      ? { ...sec, elements: cloneElements(previousElements) }
                      : sec
                  ),
                }
              : nb
          ),
        }));
      },

      redo: () => {
        const { activeNotebookId, activeSectionId, notebooks, undoStacks, redoStacks } = get();
        if (!activeNotebookId || !activeSectionId) return;

        const stack = redoStacks[activeSectionId];
        if (!stack || stack.length === 0) return;

        const currentSection = notebooks
          .find((nb) => nb.id === activeNotebookId)
          ?.sections.find((sec) => sec.id === activeSectionId);

        if (!currentSection) return;

        const nextElements = stack[stack.length - 1];
        const nextRedoStack = stack.slice(0, -1);

        const currentUndoStack = undoStacks[activeSectionId] || [];
        const nextUndoStack = [...currentUndoStack, cloneElements(currentSection.elements)].slice(-MAX_UNDO_STEPS);

        set((state) => ({
          undoStacks: { ...state.undoStacks, [activeSectionId]: nextUndoStack },
          redoStacks: { ...state.redoStacks, [activeSectionId]: nextRedoStack },
          notebooks: state.notebooks.map((nb) =>
            nb.id === activeNotebookId
              ? {
                  ...nb,
                  updatedAt: Date.now(),
                  sections: nb.sections.map((sec) =>
                    sec.id === activeSectionId
                      ? { ...sec, elements: cloneElements(nextElements) }
                      : sec
                  ),
                }
              : nb
          ),
        }));
      },

      setNotebooks: (notebooks: Notebook[]) => {
        set({
          notebooks,
          activeNotebookId: notebooks[0]?.id ?? null,
          activeSectionId: notebooks[0]?.sections[0]?.id ?? null,
        });
      },
    }),
    {
      name: 'inkwell-v1',
      version: SCHEMA_VERSION,
      partialize: (s) => ({
        notebooks: s.notebooks,
        activeNotebookId: s.activeNotebookId,
        activeSectionId: s.activeSectionId,
      }),
      migrate: (persisted, version) => {
        if (version < 1) {
          return { notebooks: [], activeNotebookId: null, activeSectionId: null };
        }
        return persisted as never;
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          localStorage.removeItem('inkwell-v1');
          location.reload();
        }
      },
    }
  )
);

// Selector helpers
export const useActiveNotebook = () =>
  useNotesStore((state) =>
    state.notebooks.find((nb) => nb.id === state.activeNotebookId)
  );

export const useActiveSection = () =>
  useNotesStore((state) => {
    const activeNb = state.notebooks.find((nb) => nb.id === state.activeNotebookId);
    return activeNb?.sections.find((sec) => sec.id === state.activeSectionId);
  });

// Debounced auto-save to disk for any notebook that has a folderPath configured
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

useNotesStore.subscribe((state, prevState) => {
  if (state.notebooks !== prevState.notebooks && state.activeNotebookId) {
    const activeNb = state.notebooks.find((nb) => nb.id === state.activeNotebookId);
    if (activeNb?.folderPath) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        saveNotebookToDisk(activeNb).catch((err) =>
          console.error('[STORAGE] Auto-save to disk error:', err)
        );
      }, 1000);
    }
  }
});

// Sync all notebooks that have a designated folderPath to disk
export function syncAllFolderNotebooks(): void {
  const { notebooks } = useNotesStore.getState();
  for (const nb of notebooks) {
    if (nb.folderPath) {
      saveNotebookToDisk(nb).catch((err) =>
        console.error(`[STORAGE] Failed to sync notebook "${nb.name}":`, err)
      );
    }
  }
}

