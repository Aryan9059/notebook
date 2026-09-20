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
  CornerUpRight,
  Sun,
  Moon,
} from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';
import { useThemeStore } from '../../store/useThemeStore';
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

  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-white/90 dark:bg-[#262626]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.1] shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] px-2.5 py-1.5 select-none no-drag transition-colors">
      {/* Add PDF button */}
      <button
        type="button"
        onClick={onAddPdfClick}
        className="h-8 px-3.5 rounded-xl bg-gray-100/90 hover:bg-gray-200/80 dark:bg-[#333333] dark:hover:bg-[#3e3e3e] active:scale-95 text-gray-800 dark:text-gray-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-black/[0.04] dark:border-white/[0.06]"
      >
        <FileUp size={14} className="text-gray-900 dark:text-gray-100" />
        <span>Add pdf</span>
      </button>

      {/* Attachment button for Images */}
      <button
        type="button"
        onClick={onAddImageClick}
        title="Add image attachment"
        className="w-8 h-8 rounded-xl bg-gray-100/90 hover:bg-gray-200/80 dark:bg-[#333333] dark:hover:bg-[#3e3e3e] active:scale-95 text-gray-700 dark:text-gray-200 flex items-center justify-center transition cursor-pointer border border-black/[0.04] dark:border-white/[0.06]"
      >
        <Paperclip size={15} />
      </button>

      {/* Hand / Select / Arrow tool segmented toggle */}
      <div className="flex items-center p-0.5 rounded-xl bg-gray-100/90 dark:bg-[#333333] border border-black/[0.04] dark:border-white/[0.06] h-8">
        <button
          type="button"
          onClick={() => setActiveTool('hand')}
          title="Hand Tool (Pan canvas) — H"
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
            activeTool === 'hand'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
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
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <MousePointer2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (activeTool === 'arrow') {
              window.dispatchEvent(new CustomEvent('inkwell-flip-arrow-draft'));
            } else {
              setActiveTool('arrow');
            }
          }}
          title="Curved Arrow Tool — A (Press 'a' while drawing to flip curve)"
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
            activeTool === 'arrow'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <CornerUpRight size={14} />
        </button>
      </div>

      {/* Segmented font controls */}
      <div className="flex items-center rounded-xl bg-gray-100/90 dark:bg-[#333333] border border-black/[0.04] dark:border-white/[0.06] h-8 px-1">
        {/* Font Family selector */}
        <div className="relative flex items-center">
          <Type size={13} className="text-gray-400 dark:text-gray-400 ml-1.5 shrink-0" />
          <select
            value={currentFontFamily}
            onChange={handleFontChange}
            className="appearance-none bg-transparent pl-1.5 pr-5 text-gray-800 dark:text-gray-200 text-xs font-medium focus:outline-none cursor-pointer"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value} className="bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100">
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
        <div className="w-[1px] h-3.5 bg-gray-300/80 dark:bg-white/10 mx-1" />

        {/* Font Size selector */}
        <div className="relative flex items-center">
          <select
            value={currentFontSize}
            onChange={handleSizeChange}
            className="appearance-none bg-transparent px-1.5 pr-4 text-gray-800 dark:text-gray-200 text-xs font-medium focus:outline-none cursor-pointer"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s} className="bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100">
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
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100/80 dark:hover:bg-white/[0.08] transition text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer"
        >
          <MoreVertical size={16} />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white/95 dark:bg-[#262626]/98 backdrop-blur-2xl shadow-[0_16px_36px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.45)] border border-black/[0.08] dark:border-white/[0.1] p-1.5 z-50 animate-fade-in">
            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={() => {
                toggleTheme();
              }}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-gray-800 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition flex items-center justify-between cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Sun size={14} className="text-amber-400" />
                ) : (
                  <Moon size={14} className="text-gray-500" />
                )}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.1] text-gray-500 dark:text-gray-400 capitalize font-mono">
                {theme}
              </span>
            </button>

            <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-1" />

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onExportPdfClick?.();
              }}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-gray-800 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition flex items-center justify-between cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <Download size={14} className="text-gray-500 dark:text-gray-400" />
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
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-gray-800 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition flex items-center justify-between cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-gray-500 dark:text-gray-400" />
                <span>Export (.inkwell.json)</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                resetViewport();
                setIsMenuOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-gray-800 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition flex items-center justify-between cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <RotateCcw size={14} className="text-gray-500 dark:text-gray-400" />
                <span>Reset View</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">⌘0</span>
            </button>
            <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-1" />
            <button
              type="button"
              onClick={handleClearCanvas}
              className="w-full px-3 py-2 rounded-lg text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition flex items-center gap-2 cursor-pointer font-medium"
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

