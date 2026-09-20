import { useRef, useEffect, useState, type ChangeEvent } from 'react';
import { useNotesStore, syncAllFolderNotebooks } from './store/useNotesStore';
import { useUiStore } from './store/useUiStore';
import { collectGarbage, putPageImage } from './store/imageStore';
import { StartScreen } from './components/Screens/StartScreen';
import { CreateNotebookDialog } from './components/Screens/CreateNotebookDialog';
import { Sidebar } from './components/Layout/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { FloatingToolbar } from './components/Layout/FloatingToolbar';
import { CanvasElements } from './components/Canvas/CanvasElements';
import { processPdfFile } from './utils/pdfProcessor';
import { exportSectionToPdf } from './utils/exportPdf';
import { ImageElement, TextElement } from './types';

export default function App() {
  const activeNotebookId = useNotesStore((state) => state.activeNotebookId);
  const activeSectionId = useNotesStore((state) => state.activeSectionId);
  const notebooks = useNotesStore((state) => state.notebooks);

  const activeNotebook = notebooks.find((nb) => nb.id === activeNotebookId);
  const activeSection = activeNotebook?.sections.find((s) => s.id === activeSectionId);

  const addElement = useNotesStore((state) => state.addElement);
  const addElements = useNotesStore((state) => state.addElements);
  const createNotebook = useNotesStore((state) => state.createNotebook);
  const setActiveNotebook = useNotesStore((state) => state.setActiveNotebook);

  const setEditingId = useUiStore((state) => state.setEditingId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const isImporting = useUiStore((state) => state.isImporting);
  const importProgress = useUiStore((state) => state.importProgress);
  const setIsImporting = useUiStore((state) => state.setIsImporting);
  const setImportProgress = useUiStore((state) => state.setImportProgress);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // §7 / §9.5: Run collectGarbage once on app start and sync any folder-based notebooks to disk
  useEffect(() => {
    const nbs = useNotesStore.getState().notebooks;
    const liveKeys = new Set<string>();
    for (const nb of nbs) {
      for (const sec of nb.sections) {
        for (const el of sec.elements) {
          if ((el.type === 'pdf-page' || el.type === 'image') && el.imageKey) {
            liveKeys.add(el.imageKey);
          }
        }
      }
    }
    collectGarbage(liveKeys).catch(console.error);
    syncAllFolderNotebooks();
  }, []); // Only run on mount — not on every notebooks change

  // Double click empty canvas creates new TextElement at canvas position (§8.1, §9.1)
  const handleDoubleClickCanvas = (canvasX: number, canvasY: number) => {
    if (!activeNotebookId || !activeSectionId) return;

    const newTextElement: TextElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: canvasX,
      y: canvasY,
      width: 320,
      height: null,
      content: '<p></p>',
      fontFamily: 'Inter',
      fontSize: 18,
      zIndex: 1000,
    };

    addElement(newTextElement);
    setSelectedId(newTextElement.id);
    setEditingId(newTextElement.id);
  };

  // Trigger PDF file picker
  const handleAddPdfClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Trigger Image attachment file picker
  const handleAddImageClick = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
      imageInputRef.current.click();
    }
  };

  // Process chosen PDF file
  const handlePdfFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSection) return;

    setIsImporting(true);
    setImportProgress({ done: 0, total: 1 });

    try {
      const container = document.getElementById('infinite-canvas-container');
      const rect = container?.getBoundingClientRect() ?? {
        width: window.innerWidth - 280,
        height: window.innerHeight,
      };

      const pages = await processPdfFile(
        file,
        activeSection.viewport,
        { width: rect.width, height: rect.height },
        (done, total) => {
          setImportProgress({ done, total });
        }
      );

      // Batch add — single store update + single undo snapshot
      addElements(pages);
    } catch (err) {
      console.error('Failed to import PDF:', err);
      showToast('Could not import PDF. Please check the file format.');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Process attached image files
  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSection) return;

    const container = document.getElementById('infinite-canvas-container');
    const rect = container?.getBoundingClientRect() ?? {
      width: window.innerWidth - 280,
      height: window.innerHeight,
    };

    const canvasCenterX = (rect.width / 2 - activeSection.viewport.x) / activeSection.viewport.zoom;
    const canvasCenterY = (rect.height / 2 - activeSection.viewport.y) / activeSection.viewport.zoom;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const imageKey = `img:${crypto.randomUUID()}`;
        await putPageImage(imageKey, file);

        // Measure natural dimensions
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        URL.revokeObjectURL(objectUrl);

        const naturalWidth = img.naturalWidth || 400;
        const naturalHeight = img.naturalHeight || 300;
        const baseWidth = Math.min(480, naturalWidth);
        const baseHeight = Math.round(baseWidth * (naturalHeight / naturalWidth));

        // Stagger multiple files slightly
        const offset = i * 24;

        const newImageElement: ImageElement = {
          id: crypto.randomUUID(),
          type: 'image',
          name: file.name,
          x: Math.round(canvasCenterX - baseWidth / 2 + offset),
          y: Math.round(canvasCenterY - baseHeight / 2 + offset),
          width: baseWidth,
          height: baseHeight,
          imageKey,
          isLocked: false,
          zIndex: 100 + i,
        };

        addElement(newImageElement);
      } catch (err) {
        console.error('Failed to load image attachment:', err);
        showToast(`Could not load image: ${file.name}`);
      }
    }
  };

  // Global Clipboard Paste Handler (Screenshots & Text directly to canvas)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        Boolean(target?.closest('.ProseMirror')) ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.isContentEditable ||
        Boolean(activeEl?.closest('.ProseMirror'));

      // If user is actively typing inside an input or text editor, let standard paste proceed
      if (isInput) return;
      if (!activeNotebookId || !activeSection) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // 1. Check for image files in clipboard (e.g. screenshots)
      let imageFile: File | null = null;
      const items = clipboardData.items;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          imageFile = items[i].getAsFile();
          break;
        }
      }

      if (!imageFile && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          if (clipboardData.files[i].type.startsWith('image/')) {
            imageFile = clipboardData.files[i];
            break;
          }
        }
      }

      if (imageFile) {
        e.preventDefault();
        const container = document.getElementById('infinite-canvas-container');
        const rect = container?.getBoundingClientRect() ?? {
          width: window.innerWidth - 280,
          height: window.innerHeight,
        };

        const canvasCenterX = (rect.width / 2 - activeSection.viewport.x) / activeSection.viewport.zoom;
        const canvasCenterY = (rect.height / 2 - activeSection.viewport.y) / activeSection.viewport.zoom;

        try {
          const imageKey = `img:${crypto.randomUUID()}`;
          await putPageImage(imageKey, imageFile);

          const img = new Image();
          const objectUrl = URL.createObjectURL(imageFile);
          img.src = objectUrl;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
          });
          URL.revokeObjectURL(objectUrl);

          const naturalWidth = img.naturalWidth || 400;
          const naturalHeight = img.naturalHeight || 300;
          const baseWidth = Math.min(500, naturalWidth);
          const baseHeight = Math.round(baseWidth * (naturalHeight / naturalWidth));

          const newImageElement: ImageElement = {
            id: crypto.randomUUID(),
            type: 'image',
            name: `Pasted Image ${new Date().toLocaleTimeString()}`,
            x: Math.round(canvasCenterX - baseWidth / 2),
            y: Math.round(canvasCenterY - baseHeight / 2),
            width: baseWidth,
            height: baseHeight,
            imageKey,
            isLocked: false,
            zIndex: 100,
          };

          addElement(newImageElement);
          setSelectedId(newImageElement.id);
          showToast('Pasted image from clipboard');
        } catch (err) {
          console.error('Failed to paste image from clipboard:', err);
          showToast('Could not paste image');
        }
        return;
      }

      // 2. Check for text in clipboard
      const pastedText = clipboardData.getData('text/plain');
      if (pastedText && pastedText.trim()) {
        e.preventDefault();
        const container = document.getElementById('infinite-canvas-container');
        const rect = container?.getBoundingClientRect() ?? {
          width: window.innerWidth - 280,
          height: window.innerHeight,
        };

        const canvasCenterX = (rect.width / 2 - activeSection.viewport.x) / activeSection.viewport.zoom;
        const canvasCenterY = (rect.height / 2 - activeSection.viewport.y) / activeSection.viewport.zoom;

        const paragraphs = pastedText
          .split('\n')
          .map((line) => `<p>${line || '<br>'}</p>`)
          .join('');

        const newTextElement: TextElement = {
          id: crypto.randomUUID(),
          type: 'text',
          x: Math.round(canvasCenterX - 170),
          y: Math.round(canvasCenterY - 30),
          width: 340,
          height: null,
          content: paragraphs || '<p></p>',
          fontFamily: 'Inter',
          fontSize: 18,
          zIndex: 1000,
        };

        addElement(newTextElement);
        setSelectedId(newTextElement.id);
        showToast('Pasted text note');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeNotebookId, activeSection, addElement, setSelectedId]);

  // Export current section to PDF
  const handleExportPdfClick = async () => {
    if (!activeNotebook || !activeSection) return;
    try {
      await exportSectionToPdf(
        activeSection.elements,
        activeNotebook.name,
        activeSection.name
      );
    } catch (err) {
      console.error('Failed to export PDF:', err);
      showToast('Export failed. Please try again.');
    }
  };

  // If no notebook is active, render StartScreen
  if (!activeNotebookId || !activeNotebook) {
    return <StartScreen />;
  }

  return (
    <div className="w-full h-full flex flex-row bg-canvas select-none relative overflow-hidden">
      {/* Titlebar drag region for macOS Overlay */}
      <div className="fixed top-0 left-0 right-0 h-7 drag-region z-50 pointer-events-none" />

      {/* Hidden PDF file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handlePdfFileChange}
        className="hidden"
      />

      {/* Hidden Image attachment input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Sidebar */}
      <Sidebar
        onNewNotebookClick={() => setIsCreateModalOpen(true)}
        onGoToStartScreen={() => setActiveNotebook(null)}
      />

      {/* Canvas Area (floating toolbar is centered over this region) */}
      <main className="flex-1 h-full relative overflow-hidden">
        {/* Floating Toolbar centered over canvas */}
        <FloatingToolbar
          onAddPdfClick={handleAddPdfClick}
          onAddImageClick={handleAddImageClick}
          onExportPdfClick={handleExportPdfClick}
        />

        {/* In-app Notification Toast */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-gray-900/90 text-white text-xs font-medium backdrop-blur-xl shadow-2xl border border-white/15 pointer-events-none flex items-center gap-2 animate-slide-down">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Async Import Progress Pill — Dynamic Island style */}
        {isImporting && importProgress && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-gray-900/90 text-white text-xs font-medium backdrop-blur-xl shadow-2xl border border-white/10 pointer-events-none flex items-center gap-3 animate-slide-down">
            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
            <span>
              Importing page {importProgress.done} of {importProgress.total}…
            </span>
          </div>
        )}

        {/* Infinite Canvas */}
        <Canvas onDoubleClickCanvas={handleDoubleClickCanvas}>
          <CanvasElements onDoubleClickCanvas={handleDoubleClickCanvas} />
        </Canvas>
      </main>

      {/* New Notebook Dialog when triggered from workspace sidebar */}
      <CreateNotebookDialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={(name, folderPath) => createNotebook(name, folderPath)}
      />
    </div>
  );
}

