import {
  type FC,
  useState,
  useEffect,
  useRef,
} from 'react';
import { GripHorizontal, Lock, Unlock } from 'lucide-react';
import { PdfPageElement } from '../../types';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';
import { getPageImageUrl } from '../../store/imageStore';

interface PdfPageCardProps {
  element: PdfPageElement;
}

export const PdfPageCard: FC<PdfPageCardProps> = ({ element }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const selectedId = useUiStore((state) => state.selectedId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const activeTool = useUiStore((state) => state.activeTool);

  const updateElement = useNotesStore((state) => state.updateElement);
  const moveElement = useNotesStore((state) => state.moveElement);

  const isSelected = selectedId === element.id;

  const [localPos, setLocalPos] = useState({ x: element.x, y: element.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setLocalPos({ x: element.x, y: element.y });
    }
  }, [element.x, element.y, isDragging]);

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
    updateElement(element.id, { isLocked: !element.isLocked });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'hand') return;
    e.stopPropagation();
    setSelectedId(element.id);

    if (element.isLocked || e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: localPos.x,
      startY: localPos.y,
    };
  };

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
      id={`pdf-page-${element.id}`}
      onClick={handleCardClick}
      className={`absolute rounded-2xl bg-white select-none overflow-hidden transition-all duration-150 ${ringStyle}`}
      style={{
        transform: `translate(${localPos.x}px, ${localPos.y}px)`,
        width: element.width,
        height: element.height + 38,
        zIndex: element.zIndex,
      }}
    >
      {/* Header bar: keeps pointer-events-auto */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`h-[38px] flex items-center justify-between px-3.5 bg-gray-100/90 backdrop-blur-md border-b border-black/[0.06] select-none ${
          element.isLocked
            ? 'cursor-default opacity-85'
            : 'cursor-grab active:cursor-grabbing hover:bg-gray-200/70'
        } transition`}
      >
        <div className="flex items-center gap-2">
          {!element.isLocked && (
            <GripHorizontal size={15} className="text-gray-400 shrink-0" />
          )}
          <span className="px-2 py-0.5 rounded-full bg-white text-[11px] font-medium text-gray-700 shadow-xs border border-black/[0.04]">
            p. {element.pageNumber} of {element.totalPages}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleLock}
          title={element.isLocked ? 'Unlock page (makes draggable)' : 'Lock page (allows writing over top)'}
          className="p-1 rounded-lg hover:bg-black/5 transition cursor-pointer text-gray-600 hover:text-black"
        >
          {element.isLocked ? (
            <Lock size={14} className="text-amber-600" />
          ) : (
            <Unlock size={14} className="text-gray-400 hover:text-gray-700" />
          )}
        </button>
      </div>

      {/* Page image layer: §9.3 - when isLocked, pointer-events: none */}
      <div
        className={`w-full relative bg-white ${
          element.isLocked ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'
        }`}
        style={{ height: element.height }}
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

        {/* Subtle lock indicator when locked */}
        {element.isLocked && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-medium flex items-center gap-1 pointer-events-none">
            <Lock size={10} /> Locked Layer
          </div>
        )}
      </div>
    </div>
  );
};
