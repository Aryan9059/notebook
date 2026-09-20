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
  calculateTargetZoom,
  clamp,
  MIN_ZOOM,
  MAX_ZOOM,
  getDotGridStyle,
  screenToCanvas,
} from '../../utils/canvasMath';
import { Viewport } from '../../types';
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
  const zoomIn = useNotesStore((state) => state.zoomIn);
  const zoomOut = useNotesStore((state) => state.zoomOut);
  const undo = useNotesStore((state) => state.undo);
  const redo = useNotesStore((state) => state.redo);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  // UI state
  const selectedId = useUiStore((state) => state.selectedId);
  const editingId = useUiStore((state) => state.editingId);
  const activeTool = useUiStore((state) => state.activeTool);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const setEditingId = useUiStore((state) => state.setEditingId);
  const setActiveTool = useUiStore((state) => state.setActiveTool);

  // Fallback viewport
  const viewport = activeSection?.viewport ?? { x: 0, y: 0, zoom: 1 };
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Pan interaction state
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Non-passive wheel & native WebKit gesture handler for trackpad pinch zoom & pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't intercept scrolling inside sidebar
      if (target?.closest('#sidebar-container')) return;

      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const current = viewportRef.current;

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch or Ctrl/Cmd + wheel zoom anchored to cursor
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const next = calculateCursorZoom(px, py, e.deltaY, current);
        setViewport(next);
      } else {
        // Trackpad 2-finger scroll pan
        setViewport({
          x: current.x - e.deltaX,
          y: current.y - e.deltaY,
        });
      }
    };

    // Native WebKit gesture tracking (Safari & macOS WKWebView trackpad pinch)
    let gestureStartZoom = 1;
    let gestureStartViewport: Viewport = { x: 0, y: 0, zoom: 1 };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartViewport = viewportRef.current;
      gestureStartZoom = viewportRef.current.zoom;
    };

    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as unknown as { scale: number; clientX?: number; clientY?: number };
      const rect = el.getBoundingClientRect();
      const clientX = typeof ge.clientX === 'number' ? ge.clientX : rect.left + rect.width / 2;
      const clientY = typeof ge.clientY === 'number' ? ge.clientY : rect.top + rect.height / 2;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const targetZoom = clamp(gestureStartZoom * ge.scale, MIN_ZOOM, MAX_ZOOM);
      const next = calculateTargetZoom(px, py, targetZoom, gestureStartViewport);
      setViewport(next);
    };

    const onGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: false });

    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, [setViewport]);

  // Space key and Tool/Zoom keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      if (e.code === 'Space' && !isInput && !e.repeat) {
        setIsSpacePressed(true);
      }

      // Quick tool toggle shortcuts: H = Hand tool, V = Select tool
      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'h' || e.code === 'KeyH') {
          e.preventDefault();
          setActiveTool('hand');
        } else if (k === 'v' || e.code === 'KeyV') {
          e.preventDefault();
          setActiveTool('select');
        }
      }

      // Keyboard shortcuts per §9.1 and Zoom controls
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.code === 'Equal' || e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      } else if ((e.metaKey || e.ctrlKey) && (e.code === 'Minus' || e.key === '-')) {
        e.preventDefault();
        zoomOut();
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
  }, [
    editingId,
    selectedId,
    setEditingId,
    setSelectedId,
    deleteElement,
    resetViewport,
    zoomIn,
    zoomOut,
    setActiveTool,
    undo,
    redo,
  ]);

  // Pointer-based pan (Hand tool, Space+drag, or middle-click drag)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const isMiddleClick = e.button === 1;
      const isSpaceDrag = isSpacePressed && e.button === 0;
      const isHandToolDrag = activeTool === 'hand' && e.button === 0;

      if (isMiddleClick || isSpaceDrag || isHandToolDrag) {
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
    [isSpacePressed, activeTool]
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

  // Double click empty canvas: invoke callback with canvas-space coordinates (only in select mode)
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === 'hand') return;

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
    : activeTool === 'hand'
    ? 'cursor-grab'
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
