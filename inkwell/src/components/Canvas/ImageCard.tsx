import {
  type FC,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { Lock, Unlock, Trash2 } from 'lucide-react';
import { ImageElement } from '../../types';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';
import { getPageImageUrl } from '../../store/imageStore';

interface ImageCardProps {
  element: ImageElement;
}

export const ImageCard: FC<ImageCardProps> = ({ element }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Store actions
  const moveElement = useNotesStore((state) => state.moveElement);
  const updateElement = useNotesStore((state) => state.updateElement);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  // UI state
  const selectedId = useUiStore((state) => state.selectedId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const activeTool = useUiStore((state) => state.activeTool);

  const isSelected = selectedId === element.id;

  // Drag interaction refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; elX: number; elY: number } | null>(null);

  // Fetch memoized object URL from IDB
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

  // Pointer drag for moving the card (P7/P8: read current zoom dynamically)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (element.isLocked) return;
      if (activeTool === 'hand') return; // Hand tool handles canvas panning instead

      const target = e.target as HTMLElement;
      if (target.closest('button')) return;

      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        elX: element.x,
        elY: element.y,
      };

      setSelectedId(element.id);
    },
    [element.id, element.isLocked, element.x, element.y, setSelectedId, activeTool]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      const state = useNotesStore.getState();
      const currentNb = state.notebooks.find((nb) => nb.id === state.activeNotebookId);
      const currentSec = currentNb?.sections.find((s) => s.id === state.activeSectionId);
      const currentZoom = currentSec?.viewport.zoom ?? 1;

      const dx = (e.clientX - dragStartRef.current.clientX) / currentZoom;
      const dy = (e.clientY - dragStartRef.current.clientY) / currentZoom;

      moveElement(element.id, dragStartRef.current.elX + dx, dragStartRef.current.elY + dy, false);
    },
    [element.id, moveElement]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDraggingRef.current) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // pointer may already be released
        }
        isDraggingRef.current = false;
        dragStartRef.current = null;
        useNotesStore.getState().commitUndoSnapshot();
      }
    },
    []
  );

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateElement(element.id, { isLocked: !element.isLocked }, true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElement(element.id);
    if (selectedId === element.id) {
      setSelectedId(null);
    }
  };

  return (
    <div
      id={`image-card-${element.id}`}
      data-element-id={element.id}
      onClick={(e) => {
        if (activeTool !== 'hand') {
          e.stopPropagation();
          setSelectedId(element.id);
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`group absolute rounded-2xl transition-shadow select-none ${
        element.isLocked || activeTool === 'hand' ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${
        isSelected
          ? 'ring-2 ring-black shadow-[0_16px_36px_rgba(0,0,0,0.16)]'
          : 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
      }`}
      style={{
        transform: `translate(${element.x}px, ${element.y}px)`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        zIndex: element.zIndex,
      }}
    >
      {/* Floating Header Control Bar (shows on hover or when selected) */}
      <div
        className={`absolute -top-10 left-0 right-0 h-8 flex items-center justify-between px-2 rounded-xl bg-white/95 backdrop-blur-xl border border-black/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-opacity z-20 ${
          isSelected || element.isLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <span className="text-[11px] font-medium text-gray-700 truncate max-w-[140px]">
            {element.name || 'Image'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Lock / Unlock Toggle Button */}
          <button
            type="button"
            onClick={toggleLock}
            title={element.isLocked ? 'Unlock Image' : 'Lock Image'}
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
              element.isLocked
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'text-gray-500 hover:text-gray-900 hover:bg-black/[0.05]'
            }`}
          >
            {element.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            title="Delete Image"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Image Content */}
      <div
        className="w-full h-full rounded-2xl overflow-hidden bg-white/50 border border-black/[0.06] shadow-sm flex items-center justify-center"
        style={{
          pointerEvents: element.isLocked ? 'none' : 'auto',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={element.name || 'Attachment'}
            className="w-full h-full object-contain rounded-2xl pointer-events-none select-none"
            draggable={false}
          />
        ) : (
          <div className="flex items-center justify-center text-gray-400 text-xs">
            Loading image…
          </div>
        )}
      </div>
    </div>
  );
};
