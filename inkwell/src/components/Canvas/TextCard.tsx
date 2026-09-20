import {
  type FC,
  useState,
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
  const selectedId = useUiStore((state) => state.selectedId);
  const editingId = useUiStore((state) => state.editingId);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const setEditingId = useUiStore((state) => state.setEditingId);

  const updateElement = useNotesStore((state) => state.updateElement);
  const moveElement = useNotesStore((state) => state.moveElement);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  const isSelected = selectedId === element.id;
  const isEditing = editingId === element.id;

  // Local drag position to avoid re-render storms (P8)
  const [localPos, setLocalPos] = useState({ x: element.x, y: element.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setLocalPos({ x: element.x, y: element.y });
    }
  }, [element.x, element.y, isDragging]);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedId(element.id);

    if (e.button !== 0) return;

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
    if (!isDragging || !dragStartRef.current) return;

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
        // Ignored
      }
      setIsDragging(false);
      dragStartRef.current = null;
      moveElement(element.id, localPos.x, localPos.y, true);
    }
  };

  const handleCardPointerDown = (e: React.PointerEvent) => {
    if (isEditing) {
      return;
    }
    e.stopPropagation();
    setSelectedId(element.id);
  };

  const handleCardDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedId(element.id);
    setEditingId(element.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElement(element.id);
    if (selectedId === element.id) setSelectedId(null);
  };

  const ringStyle = isSelected
    ? 'ring-2 ring-blue-500/90 shadow-[0_12px_36px_rgba(59,130,246,0.18)]'
    : 'border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.09)]';

  return (
    <div
      id={`card-${element.id}`}
      onPointerDown={handleCardPointerDown}
      onDoubleClick={handleCardDoubleClick}
      className={`absolute select-none rounded-2xl bg-white/95 backdrop-blur-sm transition-all duration-150 ${ringStyle}`}
      style={{
        transform: `translate(${localPos.x}px, ${localPos.y}px)`,
        width: element.width || 320,
        zIndex: element.zIndex,
      }}
    >
      {/* Sleek drag handle bar */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="h-8 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-black/[0.04] bg-gray-50/80 rounded-t-2xl hover:bg-gray-100/80 transition"
      >
        <div className="flex items-center gap-1.5 text-gray-400">
          <GripHorizontal size={15} />
        </div>

        {isSelected && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete note"
            className="p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Editor Body */}
      <div
        className="p-5 cursor-text text-gray-900"
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
