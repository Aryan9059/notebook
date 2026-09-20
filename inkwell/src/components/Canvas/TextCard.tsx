import {
  type FC,
  memo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { GripHorizontal, Trash2 } from 'lucide-react';
import { TextElement } from '../../types';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';

interface TextCardProps {
  element: TextElement;
}

const TextCardInner: FC<TextCardProps> = ({ element }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const selectedId = useUiStore((state) => state.selectedId);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const editingId = useUiStore((state) => state.editingId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const setEditingId = useUiStore((state) => state.setEditingId);
  const activeTool = useUiStore((state) => state.activeTool);

  const updateElement = useNotesStore((state) => state.updateElement);
  const moveElement = useNotesStore((state) => state.moveElement);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  const isSelected = selectedId === element.id || selectedIds.includes(element.id);
  const isEditing = editingId === element.id;

  // Track position using refs for 120fps hardware-accelerated drag without React re-render lag
  const isDraggingRef = useRef(false);
  const posRef = useRef({ x: element.x, y: element.y });
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Resize handling
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; startWidth: number } | null>(null);
  const currentWidthRef = useRef(element.width || 340);

  // Sync external position and width updates
  useEffect(() => {
    if (!isDraggingRef.current) {
      posRef.current = { x: element.x, y: element.y };
      if (cardRef.current) {
        cardRef.current.style.transform = `translate(${element.x}px, ${element.y}px)`;
      }
    }
  }, [element.x, element.y]);

  useEffect(() => {
    if (!isResizingRef.current) {
      const w = element.width || 340;
      currentWidthRef.current = w;
      if (cardRef.current) {
        cardRef.current.style.width = `${w}px`;
      }
    }
  }, [element.width]);

  const editor = useEditor({
    extensions: [StarterKit, TextStyleKit],
    content: element.content,
    editable: isEditing,
    onUpdate: ({ editor: ed }) => {
      updateElement(element.id, { content: ed.getHTML() }, false);
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
      if (isEditing) {
        editor.commands.focus('end');
      }
    }
  }, [editor, isEditing]);

  const handleBlur = useCallback(() => {
    if (editor) {
      const isEmpty = editor.isEmpty || editor.getText().trim() === '';
      if (isEmpty) {
        deleteElement(element.id);
        if (selectedId === element.id) setSelectedId(null);
        if (editingId === element.id) setEditingId(null);
      } else {
        setEditingId(null);
      }
    }
  }, [editor, deleteElement, element.id, selectedId, editingId, setSelectedId, setEditingId]);

  // Smooth drag handling
  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'hand' || activeTool === 'arrow') return;
    e.stopPropagation();
    setSelectedId(element.id);

    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;

    const state = useNotesStore.getState();
    const activeNb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    const activeSec = activeNb?.sections.find((s) => s.id === state.activeSectionId);
    const zoom = activeSec?.viewport.zoom ?? 1;

    const dxCanvas = (e.clientX - dragStartRef.current.clientX) / zoom;
    const dyCanvas = (e.clientY - dragStartRef.current.clientY) / zoom;

    const nextX = dragStartRef.current.startX + dxCanvas;
    const nextY = dragStartRef.current.startY + dyCanvas;
    posRef.current = { x: nextX, y: nextY };

    if (cardRef.current) {
      cardRef.current.style.transform = `translate(${nextX}px, ${nextY}px)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      isDraggingRef.current = false;
      dragStartRef.current = null;
      moveElement(element.id, posRef.current.x, posRef.current.y, true);
    }
  };

  // Resize pointer event handlers
  const handleResizePointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'hand') return;
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isResizingRef.current = true;
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startWidth: currentWidthRef.current,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingRef.current || !resizeStartRef.current) return;
    e.stopPropagation();

    const state = useNotesStore.getState();
    const activeNb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    const activeSec = activeNb?.sections.find((s) => s.id === state.activeSectionId);
    const zoom = activeSec?.viewport.zoom ?? 1;

    const dxCanvas = (e.clientX - resizeStartRef.current.clientX) / zoom;
    const nextWidth = Math.max(160, Math.round(resizeStartRef.current.startWidth + dxCanvas));

    currentWidthRef.current = nextWidth;
    if (cardRef.current) {
      cardRef.current.style.width = `${nextWidth}px`;
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (isResizingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      isResizingRef.current = false;
      resizeStartRef.current = null;
      updateElement(element.id, { width: currentWidthRef.current }, true);
    }
  };

  const handleCardPointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'hand' || activeTool === 'arrow') return;
    if (isEditing) return;
    e.stopPropagation();
    setSelectedId(element.id);
  };

  const handleCardDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === 'hand') return;
    e.stopPropagation();
    setSelectedId(element.id);
    setEditingId(element.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElement(element.id);
    if (selectedId === element.id) setSelectedId(null);
  };

  return (
    <div
      ref={cardRef}
      id={`card-${element.id}`}
      onPointerDown={handleCardPointerDown}
      onDoubleClick={handleCardDoubleClick}
      className={`group absolute select-none bg-transparent transition-shadow duration-100 ${
        isSelected || isEditing
          ? 'outline-1 outline-dashed outline-gray-400/80 dark:outline-gray-500/80 rounded-xl'
          : 'hover:outline-1 hover:outline-dashed hover:outline-gray-300/60 dark:hover:outline-gray-600/60 rounded-xl'
      }`}
      style={{
        transform: `translate(${element.x}px, ${element.y}px)`,
        width: element.width || 340,
        zIndex: element.zIndex,
      }}
    >
      {/* OneNote style minimal drag grip bar above the text note */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute -top-6 left-0 right-0 h-5 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing transition-opacity rounded-t-lg ${
          isSelected || isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition">
          <GripHorizontal size={14} />
          <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 dark:text-gray-500">Note</span>
        </div>

        {isSelected && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete note"
            className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Transparent Text Body (Microsoft OneNote seamless style) */}
      <div
        className="p-2 cursor-text text-gray-900 dark:text-[#ECECEC] leading-relaxed outline-none"
        onBlur={handleBlur}
        style={{
          fontFamily: element.fontFamily || 'inherit',
          fontSize: `${element.fontSize || 18}px`,
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Resize Handles (Right Edge + Bottom-Right Corner) */}
      {(isSelected || isEditing) && (
        <>
          {/* Right edge resize bar */}
          <div
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            title="Drag to resize width"
            className="absolute top-2 bottom-2 -right-1.5 w-3 cursor-ew-resize flex items-center justify-center group/resize z-20"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="w-1 h-6 rounded-full bg-gray-400/40 dark:bg-gray-500/40 group-hover/resize:bg-black dark:group-hover/resize:bg-white group-hover/resize:scale-y-125 transition-all" />
          </div>

          {/* Bottom-right corner handle */}
          <div
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            title="Drag to resize width"
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 cursor-nwse-resize flex items-center justify-center group/corner z-20"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-[#262626] border-[1.5px] border-gray-600 dark:border-gray-300 group-hover/corner:border-black dark:group-hover/corner:border-white group-hover/corner:scale-125 transition-all shadow-xs" />
          </div>
        </>
      )}
    </div>
  );
};

export const TextCard = memo(TextCardInner, (prev, next) => {
  const pe = prev.element;
  const ne = next.element;
  return (
    pe.id === ne.id &&
    pe.x === ne.x &&
    pe.y === ne.y &&
    pe.width === ne.width &&
    pe.height === ne.height &&
    pe.content === ne.content &&
    pe.fontFamily === ne.fontFamily &&
    pe.fontSize === ne.fontSize &&
    pe.zIndex === ne.zIndex
  );
});
