import { useRef, useEffect, useState, type ChangeEvent } from 'react';
import { useNotesStore } from './store/useNotesStore';
import { useUiStore } from './store/useUiStore';
import { collectGarbage } from './store/imageStore';
import { StartScreen } from './components/Screens/StartScreen';
import { CreateNotebookDialog } from './components/Screens/CreateNotebookDialog';
import { Sidebar } from './components/Layout/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { FloatingToolbar } from './components/Layout/FloatingToolbar';
import { TextCard } from './components/Canvas/TextCard';
import { PdfPageCard } from './components/Canvas/PdfPageCard';
import { processPdfFile } from './utils/pdfProcessor';
import { exportSectionToPdf } from './utils/exportPdf';
import { TextElement } from './types';

export default function App() {
  const activeNotebookId = useNotesStore((state) => state.activeNotebookId);
  const activeSectionId = useNotesStore((state) => state.activeSectionId);
  const notebooks = useNotesStore((state) => state.notebooks);

  const activeNotebook = notebooks.find((nb) => nb.id === activeNotebookId);
  const activeSection = activeNotebook?.sections.find((s) => s.id === activeSectionId);

  const addElement = useNotesStore((state) => state.addElement);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // §7 / §9.5: Run collectGarbage once on app start
  useEffect(() => {
    const liveKeys = new Set<string>();
    for (const nb of notebooks) {
      for (const sec of nb.sections) {
        for (const el of sec.elements) {
          if (el.type === 'pdf-page' && el.imageKey) {
            liveKeys.add(el.imageKey);
          }
        }
      }
    }
    collectGarbage(liveKeys).catch(console.error);
  }, [notebooks]);

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

      for (const page of pages) {
        addElement(page);
      }
    } catch (err) {
      console.error('Failed to import PDF:', err);
      showToast('Could not import PDF. Please check the file format.');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

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
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping shrink-0" />
            <span>
              Importing page {importProgress.done} of {importProgress.total}…
            </span>
          </div>
        )}

        {/* Infinite Canvas */}
        <Canvas onDoubleClickCanvas={handleDoubleClickCanvas}>
          {activeSection?.elements.map((el) => {
            if (el.type === 'text') {
              return <TextCard key={el.id} element={el} />;
            }
            if (el.type === 'pdf-page') {
              return <PdfPageCard key={el.id} element={el} />;
            }
            return null;
          })}
        </Canvas>
      </main>

      {/* New Notebook Dialog when triggered from workspace sidebar */}
      <CreateNotebookDialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={(name) => createNotebook(name)}
      />
    </div>
  );
}
