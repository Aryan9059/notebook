import {
  type FC,
  type ReactNode,
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';
import {
  calculateCursorZoom,
  getDotGridStyle,
  screenToCanvas,
} from '../../utils/canvasMath';
import { WorldLayer } from './WorldLayer';

interface CanvasProps {
  children?: ReactNode;
  onDoubleClickCanvas?: (canvasX: number, canvasY: number) => void;
}

export const Canvas: FC<CanvasProps> = ({ children, onDoubleClickCanvas }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Active section & viewport
  const activeSection = useNotesStore((state) => {
    const nb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    return nb?.sections.find((s) => s.id === state.activeSectionId);
  });

  const setViewport = useNotesStore((state) => state.setViewport);
  const resetViewport = useNotesStore((state) => state.resetViewport);
  const undo = useNotesStore((state) => state.undo);
  const redo = useNotesStore((state) => state.redo);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  // UI state
  const selectedId = useUiStore((state) => state.selectedId);
  const editingId = useUiStore((state) => state.editingId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const setEditingId = useUiStore((state) => state.setEditingId);

  // Fallback viewport
  const viewport = activeSection?.viewport ?? { x: 0, y: 0, zoom: 1 };
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Pan interaction state
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Non-passive wheel handler (P3: macOS trackpad pinch arrives as wheel with ctrlKey)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const current = viewportRef.current;

      if (e.ctrlKey || e.metaKey) {
        // Zoom anchored to cursor
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const next = calculateCursorZoom(px, py, e.deltaY, current);
        setViewport(next);
      } else {
        // Pan
        setViewport({
          x: current.x - e.deltaX,
          y: current.y - e.deltaY,
        });
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    // Swallow legacy WebKit gesture events
    const preventGesture = (e: Event) => e.preventDefault();
    el.addEventListener('gesturestart', preventGesture);
    el.addEventListener('gesturechange', preventGesture);
    el.addEventListener('gestureend', preventGesture);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', preventGesture);
      el.removeEventListener('gesturechange', preventGesture);
      el.removeEventListener('gestureend', preventGesture);
    };
  }, [setViewport]);

  // Space key tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.ProseMirror');

      if (e.code === 'Space' && !isInput && !e.repeat) {
        setIsSpacePressed(true);
      }

      // Keyboard shortcuts per §9.1
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'Digit0') {
        e.preventDefault();
        resetViewport();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (editingId) {
          setEditingId(null);
        } else if (selectedId) {
          setSelectedId(null);
        }
      } else if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        selectedId &&
        !editingId &&
        !isInput
      ) {
        e.preventDefault();
        deleteElement(selectedId);
        setSelectedId(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingId, selectedId, setEditingId, setSelectedId, deleteElement, resetViewport, undo, redo]);

  // Pointer-based pan (Space+drag or middle-click drag)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const isMiddleClick = e.button === 1;
      const isSpaceDrag = isSpacePressed && e.button === 0;

      if (isMiddleClick || isSpaceDrag) {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPanning(true);
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          startX: viewportRef.current.x,
          startY: viewportRef.current.y,
        };
      }
    },
    [isSpacePressed]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setViewport({
        x: panStartRef.current.startX + dx,
        y: panStartRef.current.startY + dy,
      });
    },
    [isPanning, setViewport]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // pointer might already be released
        }
        setIsPanning(false);
        panStartRef.current = null;
      }
    },
    [isPanning]
  );

  // Click empty canvas: deselect and exit edit mode
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-world-layer') {
      setSelectedId(null);
      setEditingId(null);
    }
  };

  // Double click empty canvas: invoke callback with canvas-space coordinates
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).id === 'canvas-world-layer'
    ) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const coords = screenToCanvas(e.clientX, e.clientY, viewportRef.current, rect);
      onDoubleClickCanvas?.(coords.x, coords.y);
    }
  };

  const gridStyle = getDotGridStyle(viewport);

  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : isSpacePressed
    ? 'cursor-grab'
    : 'cursor-default';

  return (
    <div
      ref={containerRef}
      id="infinite-canvas-container"
      tabIndex={-1}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full h-full overflow-hidden select-none outline-none ${cursorClass}`}
      style={{
        ...gridStyle,
        backgroundColor: 'var(--color-canvas)',
      }}
    >
      <WorldLayer viewport={viewport}>
        {children}
      </WorldLayer>
    </div>
  );
};
