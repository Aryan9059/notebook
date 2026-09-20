import {
  type FC,
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

export const TextCard: FC<TextCardProps> = ({ element }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const selectedId = useUiStore((state) => state.selectedId);
  const editingId = useUiStore((state) => state.editingId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const setEditingId = useUiStore((state) => state.setEditingId);
  const activeTool = useUiStore((state) => state.activeTool);

  const updateElement = useNotesStore((state) => state.updateElement);
  const moveElement = useNotesStore((state) => state.moveElement);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  const isSelected = selectedId === element.id;
  const isEditing = editingId === element.id;

  // Track position using refs for 120fps hardware-accelerated drag without React re-render lag
  const isDraggingRef = useRef(false);
  const posRef = useRef({ x: element.x, y: element.y });
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Sync external position updates
  useEffect(() => {
    if (!isDraggingRef.current) {
      posRef.current = { x: element.x, y: element.y };
      if (cardRef.current) {
        cardRef.current.style.transform = `translate(${element.x}px, ${element.y}px)`;
      }
    }
  }, [element.x, element.y]);

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
    if (activeTool === 'hand') return;
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

  const handleCardPointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'hand') return;
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
          ? 'outline-1 outline-dashed outline-gray-400/80 rounded-xl'
          : 'hover:outline-1 hover:outline-dashed hover:outline-gray-300/60 rounded-xl'
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
        <div className="flex items-center gap-1 text-gray-500 hover:text-black transition">
          <GripHorizontal size={14} />
          <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Note</span>
        </div>

        {isSelected && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete note"
            className="p-0.5 rounded hover:bg-black/5 text-gray-400 hover:text-red-600 transition cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Transparent Text Body (Microsoft OneNote seamless style) */}
      <div
        className="p-2 cursor-text text-gray-900 leading-relaxed outline-none"
        onBlur={handleBlur}
        style={{
          fontFamily: element.fontFamily || 'inherit',
          fontSize: `${element.fontSize || 18}px`,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
