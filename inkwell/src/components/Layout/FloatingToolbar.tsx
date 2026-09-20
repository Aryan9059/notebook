import {
  type FC,
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
} from 'react';
import {
  FileUp,
  ChevronDown,
  MoreVertical,
  Type,
  Download,
  FileText,
  RotateCcw,
  Trash2,
  Paperclip,
  Hand,
  MousePointer2,
} from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';
import { TextElement } from '../../types';

interface FloatingToolbarProps {
  onAddPdfClick: () => void;
  onAddImageClick: () => void;
  onExportPdfClick?: () => void;
}

const FONT_FAMILIES = [
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Inter', value: 'Inter' },
  { label: 'System', value: 'var(--font-ui)' },
  { label: 'Fira Code', value: 'Fira Code, monospace' },
];

const FONT_SIZES = [14, 16, 18, 24, 32, 48];

export const FloatingToolbar: FC<FloatingToolbarProps> = ({
  onAddPdfClick,
  onAddImageClick,
  onExportPdfClick,
}) => {
  const selectedId = useUiStore((state) => state.selectedId);
  const activeTool = useUiStore((state) => state.activeTool);
  const setActiveTool = useUiStore((state) => state.setActiveTool);

  const activeNotebook = useNotesStore((state) =>
    state.notebooks.find((n) => n.id === state.activeNotebookId)
  );

  const activeSection = useNotesStore((state) => {
    const nb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    return nb?.sections.find((s) => s.id === state.activeSectionId);
  });

  const updateElement = useNotesStore((state) => state.updateElement);
  const resetViewport = useNotesStore((state) => state.resetViewport);
  const clearCanvas = useNotesStore((state) => state.clearCanvas);

  const selectedTextElement = activeSection?.elements.find(
    (el) => el.id === selectedId && el.type === 'text'
  ) as TextElement | undefined;

  const [defaultFontFamily, setDefaultFontFamily] = useState('Inter');
  const [defaultFontSize, setDefaultFontSize] = useState(18);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const currentFontFamily = selectedTextElement?.fontFamily ?? defaultFontFamily;
  const currentFontSize = selectedTextElement?.fontSize ?? defaultFontSize;

  const handleFontChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDefaultFontFamily(val);
    if (selectedTextElement) {
      updateElement(selectedTextElement.id, { fontFamily: val }, true);
    }
  };

  const handleSizeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    setDefaultFontSize(val);
    if (selectedTextElement) {
      updateElement(selectedTextElement.id, { fontSize: val }, true);
    }
  };

  const handleClearCanvas = () => {
    setIsMenuOpen(false);
    if (window.confirm('Are you sure you want to clear the entire canvas in this section?')) {
      clearCanvas();
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-2xl border border-black/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.08)] px-2.5 py-1.5 select-none no-drag">
      {/* Add PDF button */}
      <button
        type="button"
        onClick={onAddPdfClick}
        className="h-8 px-3.5 rounded-xl bg-gray-100/90 hover:bg-gray-200/80 active:scale-95 text-gray-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-black/[0.04]"
      >
        <FileUp size={14} className="text-gray-900" />
        <span>Add pdf</span>
      </button>

      {/* Attachment button for Images */}
      <button
        type="button"
        onClick={onAddImageClick}
        title="Add image attachment"
        className="w-8 h-8 rounded-xl bg-gray-100/90 hover:bg-gray-200/80 active:scale-95 text-gray-700 flex items-center justify-center transition cursor-pointer border border-black/[0.04]"
      >
        <Paperclip size={15} />
      </button>

      {/* Hand / Select tool segmented toggle */}
      <div className="flex items-center p-0.5 rounded-xl bg-gray-100/90 border border-black/[0.04] h-8">
        <button
          type="button"
          onClick={() => setActiveTool('hand')}
          title="Hand Tool (Pan canvas) — H"
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
            activeTool === 'hand'
              ? 'bg-black text-white shadow-sm font-semibold'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Hand size={14} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('select')}
          title="Select Tool — V"
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
            activeTool === 'select'
              ? 'bg-black text-white shadow-sm font-semibold'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <MousePointer2 size={14} />
        </button>
      </div>

      {/* Segmented font controls */}
      <div className="flex items-center rounded-xl bg-gray-100/90 border border-black/[0.04] h-8 px-1">
        {/* Font Family selector */}
        <div className="relative flex items-center">
          <Type size={13} className="text-gray-400 ml-1.5 shrink-0" />
          <select
            value={currentFontFamily}
            onChange={handleFontChange}
            className="appearance-none bg-transparent pl-1.5 pr-5 text-gray-800 text-xs font-medium focus:outline-none cursor-pointer"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-1.5 text-gray-400"
          />
        </div>

        {/* Separator line */}
        <div className="w-[1px] h-3.5 bg-gray-300/80 mx-1" />

        {/* Font Size selector */}
        <div className="relative flex items-center">
          <select
            value={currentFontSize}
            onChange={handleSizeChange}
            className="appearance-none bg-transparent px-1.5 pr-4 text-gray-800 text-xs font-medium focus:outline-none cursor-pointer"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-1 text-gray-400"
          />
        </div>
      </div>

      {/* More / Overflow menu */}
      <div ref={menuRef} className="relative flex items-center">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          title="More options"
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100/80 transition text-gray-600 hover:text-gray-900 cursor-pointer"
        >
          <MoreVertical size={16} />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white/95 backdrop-blur-2xl shadow-[0_16px_36px_rgba(0,0,0,0.14)] border border-black/[0.08] p-1.5 z-50 animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onExportPdfClick?.();
              }}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-gray-800 hover:bg-black/[0.04] transition flex items-center justify-between cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <Download size={14} className="text-gray-500" />
                <span>Export as PDF</span>
              </div>
            </button>
            <button
              type="button"
              onClick={async () => {
                setIsMenuOpen(false);
                if (activeNotebook) {
                  const { exportNotebookBundle } = await import('../../utils/bundle');
                  await exportNotebookBundle(activeNotebook);
                }
              }}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-gray-800 hover:bg-black/[0.04] transition flex items-center justify-between cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-gray-500" />
                <span>Export (.inkwell.json)</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                resetViewport();
                setIsMenuOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-gray-800 hover:bg-black/[0.04] transition flex items-center justify-between cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <RotateCcw size={14} className="text-gray-500" />
                <span>Reset View</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">⌘0</span>
            </button>
            <div className="border-t border-black/[0.06] my-1" />
            <button
              type="button"
              onClick={handleClearCanvas}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-red-600 hover:bg-red-500/10 transition flex items-center gap-2 cursor-pointer font-medium"
            >
              <Trash2 size={14} />
              <span>Clear Canvas</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

