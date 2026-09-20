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

  // Track mouse coordinates for anchor zoom
  const mousePosRef = useRef({
    clientX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    clientY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  });
  const isGesturingRef = useRef(false);

  // Non-passive wheel & native WebKit gesture handler for trackpad pinch zoom & pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't intercept scrolling inside sidebar
      if (target?.closest('#sidebar-container')) return;

      e.preventDefault();
      // If WebKit GestureEvent is actively controlling pinch zoom, avoid clashing
      if (isGesturingRef.current) return;

      const rect = el.getBoundingClientRect();
      const current = viewportRef.current;
      mousePosRef.current = { clientX: e.clientX, clientY: e.clientY };

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch (Blink/Gecko) or Ctrl/Cmd + wheel zoom anchored to cursor
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

    // Native WebKit gesture tracking (macOS WKWebView & Safari trackpad pinch)
    let gestureStartZoom = 1;
    let gestureStartViewport: Viewport = { x: 0, y: 0, zoom: 1 };
    let gestureAnchorX = 0;
    let gestureAnchorY = 0;

    const onGestureStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('#sidebar-container')) return;

      const wasPrevented = e.defaultPrevented;
      e.preventDefault();
      if (wasPrevented) return;

      isGesturingRef.current = true;
      const rect = el.getBoundingClientRect();
      gestureStartViewport = viewportRef.current;
      gestureStartZoom = viewportRef.current.zoom;

      const mouseX = mousePosRef.current.clientX;
      const mouseY = mousePosRef.current.clientY;
      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        gestureAnchorX = mouseX - rect.left;
        gestureAnchorY = mouseY - rect.top;
      } else {
        gestureAnchorX = rect.width / 2;
        gestureAnchorY = rect.height / 2;
      }
    };

    const onGestureChange = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('#sidebar-container')) return;

      const wasPrevented = e.defaultPrevented;
      e.preventDefault();
      if (wasPrevented) return;

      const ge = e as unknown as { scale: number };
      if (typeof ge.scale !== 'number' || isNaN(ge.scale) || ge.scale <= 0) return;

      const targetZoom = clamp(gestureStartZoom * ge.scale, MIN_ZOOM, MAX_ZOOM);
      const k = targetZoom / gestureStartZoom;
      setViewport({
        x: gestureAnchorX - k * (gestureAnchorX - gestureStartViewport.x),
        y: gestureAnchorY - k * (gestureAnchorY - gestureStartViewport.y),
        zoom: targetZoom,
      });
    };

    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      setTimeout(() => {
        isGesturingRef.current = false;
      }, 60);
    };

    // Attach wheel listener to el
    el.addEventListener('wheel', onWheel, { passive: false });

    // Attach WebKit gesture listeners to document and window
    document.addEventListener('gesturestart', onGestureStart, { passive: false });
    document.addEventListener('gesturechange', onGestureChange, { passive: false });
    document.addEventListener('gestureend', onGestureEnd, { passive: false });
    window.addEventListener('gesturestart', onGestureStart, { passive: false });
    window.addEventListener('gesturechange', onGestureChange, { passive: false });
    window.addEventListener('gestureend', onGestureEnd, { passive: false });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('wheel', onWheel);
      document.removeEventListener('gesturestart', onGestureStart);
      document.removeEventListener('gesturechange', onGestureChange);
      document.removeEventListener('gestureend', onGestureEnd);
      window.removeEventListener('gesturestart', onGestureStart);
      window.removeEventListener('gesturechange', onGestureChange);
      window.removeEventListener('gestureend', onGestureEnd);
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
