import {
  type FC,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { GripHorizontal, Lock, Unlock, Trash2 } from 'lucide-react';
import { PdfPageElement } from '../../types';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';
import { getPageImageUrl } from '../../store/imageStore';

interface PdfPageCardProps {
  element: PdfPageElement;
}

export const PdfPageCard: FC<PdfPageCardProps> = ({ element }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const selectedId = useUiStore((state) => state.selectedId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const activeTool = useUiStore((state) => state.activeTool);

  const updateElement = useNotesStore((state) => state.updateElement);
  const moveElement = useNotesStore((state) => state.moveElement);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  const isSelected = selectedId === element.id;

  const [localPos, setLocalPos] = useState({ x: element.x, y: element.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Resize refs
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{
    clientX: number;
    clientY: number;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
    handle: 'se' | 'sw';
  } | null>(null);
  const currentDimensionsRef = useRef({ width: element.width, height: element.height });

  useEffect(() => {
    if (!isDragging) {
      setLocalPos({ x: element.x, y: element.y });
    }
  }, [element.x, element.y, isDragging]);

  useEffect(() => {
    if (!isResizingRef.current) {
      currentDimensionsRef.current = { width: element.width, height: element.height };
      if (cardRef.current) {
        cardRef.current.style.width = `${element.width}px`;
        cardRef.current.style.height = `${element.height}px`;
      }
    }
  }, [element.width, element.height]);

  useEffect(() => {
    let isCancelled = false;
    getPageImageUrl(element.imageKey).then((url) => {
      if (!isCancelled && url) {
        setImageUrl(url);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [element.imageKey]);

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextLocked = !element.isLocked;
    updateElement(element.id, { isLocked: nextLocked }, true);
    if (!nextLocked) {
      setSelectedId(element.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElement(element.id);
    if (selectedId === element.id) setSelectedId(null);
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('[data-control-bar]') ||
        target.closest('[data-lock-badge]') ||
        target.closest('[data-resize-handle]')
      ) {
        e.stopPropagation();
        return;
      }

      if (element.isLocked) return;
      if (activeTool === 'hand') return;
      if (e.button !== 0) return;

      e.stopPropagation();
      setSelectedId(element.id);

      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startX: localPos.x,
        startY: localPos.y,
      };
    },
    [element.id, element.isLocked, activeTool, localPos.x, localPos.y, setSelectedId]
  );

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || element.isLocked) return;

    const state = useNotesStore.getState();
    const activeNb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    const activeSec = activeNb?.sections.find((s) => s.id === state.activeSectionId);
    const zoom = activeSec?.viewport.zoom ?? 1;

    const dxCanvas = (e.clientX - dragStartRef.current.clientX) / zoom;
    const dyCanvas = (e.clientY - dragStartRef.current.clientY) / zoom;

    setLocalPos({
      x: dragStartRef.current.startX + dxCanvas,
      y: dragStartRef.current.startY + dyCanvas,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer might already be released
      }
      setIsDragging(false);
      dragStartRef.current = null;
      moveElement(element.id, localPos.x, localPos.y, true);
    }
  };

  // Resize pointer handlers
  const handleResizePointerDown = (e: React.PointerEvent, handle: 'se' | 'sw') => {
    if (element.isLocked || activeTool === 'hand') return;
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isResizingRef.current = true;
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startWidth: currentDimensionsRef.current.width,
      startHeight: currentDimensionsRef.current.height,
      startX: localPos.x,
      startY: localPos.y,
      handle,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingRef.current || !resizeStartRef.current) return;
    e.stopPropagation();

    const state = useNotesStore.getState();
    const activeNb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    const activeSec = activeNb?.sections.find((s) => s.id === state.activeSectionId);
    const zoom = activeSec?.viewport.zoom ?? 1;

    const start = resizeStartRef.current;
    const dx = (e.clientX - start.clientX) / zoom;
    const aspectRatio = Math.max(0.1, start.startWidth / start.startHeight);

    let nextWidth = start.startWidth;
    let nextHeight = start.startHeight;

    if (start.handle === 'se') {
      nextWidth = Math.max(160, Math.round(start.startWidth + dx));
      nextHeight = Math.max(120, Math.round(nextWidth / aspectRatio));
    } else if (start.handle === 'sw') {
      nextWidth = Math.max(160, Math.round(start.startWidth - dx));
      nextHeight = Math.max(120, Math.round(nextWidth / aspectRatio));
      const nextX = start.startX - (nextWidth - start.startWidth);
      setLocalPos((prev) => ({ ...prev, x: nextX }));
    }

    currentDimensionsRef.current = { width: nextWidth, height: nextHeight };

    if (cardRef.current) {
      cardRef.current.style.width = `${nextWidth}px`;
      cardRef.current.style.height = `${nextHeight}px`;
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (isResizingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      const start = resizeStartRef.current;
      isResizingRef.current = false;
      resizeStartRef.current = null;

      if (start && start.handle === 'sw') {
        moveElement(element.id, localPos.x, localPos.y, false);
      }

      updateElement(
        element.id,
        {
          width: currentDimensionsRef.current.width,
          height: currentDimensionsRef.current.height,
        },
        true
      );
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!element.isLocked && activeTool !== 'hand') {
      e.stopPropagation();
      setSelectedId(element.id);
    }
  };

  const ringStyle = isSelected
    ? 'ring-2 ring-black shadow-[0_16px_48px_rgba(0,0,0,0.16)]'
    : 'shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-black/[0.08]';

  return (
    <div
      ref={cardRef}
      id={`pdf-page-${element.id}`}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`absolute rounded-2xl bg-white select-none transition-shadow duration-150 ${ringStyle} ${
        element.isLocked || activeTool === 'hand' ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        transform: `translate(${localPos.x}px, ${localPos.y}px)`,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
      }}
    >
      {/* Floating Control Bar (ONLY shows when isSelected) */}
      {isSelected && (
        <div
          data-control-bar="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-10 left-0 right-0 h-8 flex items-center justify-between px-2.5 rounded-xl bg-white/95 backdrop-blur-xl border border-black/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.1)] z-40 animate-fade-in"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <GripHorizontal size={14} className="text-gray-400 shrink-0" />
            <span className="px-2 py-0.5 rounded-full bg-black/5 text-[10px] font-semibold text-gray-700">
              p. {element.pageNumber} of {element.totalPages}
            </span>
            <span className="text-[11px] font-medium text-gray-600 truncate max-w-[140px]">
              {element.pdfName}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Lock / Unlock Toggle Button */}
            <button
              type="button"
              onClick={handleToggleLock}
              onPointerDown={(e) => e.stopPropagation()}
              title={element.isLocked ? 'Unlock Page' : 'Lock Page'}
              className={`px-2 py-0.5 rounded-lg flex items-center gap-1 text-xs font-medium transition cursor-pointer ${
                element.isLocked
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/[0.05]'
              }`}
            >
              {element.isLocked ? (
                <>
                  <Lock size={12} className="text-amber-700" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <Unlock size={12} className="text-gray-500" />
                  <span>Lock</span>
                </>
              )}
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={handleDelete}
              onPointerDown={(e) => e.stopPropagation()}
              title="Delete Page"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Locked Badge in top-right corner when locked */}
      {element.isLocked && (
        <button
          type="button"
          data-lock-badge="true"
          onClick={handleToggleLock}
          onPointerDown={(e) => e.stopPropagation()}
          title="Page is locked. Click to unlock."
          className="absolute top-2.5 right-2.5 z-30 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[11px] font-medium flex items-center gap-1.5 shadow-md backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 border border-white/10"
          style={{ pointerEvents: 'auto' }}
        >
          <Lock size={12} className="text-amber-400" />
          <span>Locked</span>
        </button>
      )}

      {/* Page image layer: §9.3 - when isLocked, pointer-events: none */}
      <div
        className={`w-full h-full relative bg-white rounded-2xl overflow-hidden ${
          element.isLocked ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${element.pdfName} page ${element.pageNumber}`}
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-xs font-mono">
            Loading page {element.pageNumber}...
          </div>
        )}
      </div>

      {/* Resize Handles (Bottom-right and Bottom-left corner handles) */}
      {isSelected && !element.isLocked && activeTool !== 'hand' && (
        <>
          {/* Bottom-right corner (primary) */}
          <div
            data-resize-handle="se"
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            title="Drag to resize page"
            className="absolute -bottom-2 -right-2 w-5 h-5 cursor-nwse-resize flex items-center justify-center group/se z-30"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-black group-hover/se:scale-125 transition-transform shadow-md" />
          </div>

          {/* Bottom-left corner */}
          <div
            data-resize-handle="sw"
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            title="Drag to resize page"
            className="absolute -bottom-2 -left-2 w-5 h-5 cursor-nesw-resize flex items-center justify-center group/sw z-30"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-black group-hover/sw:scale-125 transition-transform shadow-md" />
          </div>
        </>
      )}
    </div>
  );
};
