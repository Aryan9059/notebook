import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Search, Layers, Notebook as NotebookIcon, CornerDownLeft } from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import {
  searchAndRankItems,
  type SearchItem,
  type ScoredSearchItem,
} from '../../utils/fuzzySearch';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const notebooks = useNotesStore((state) => state.notebooks);
  const activeNotebookId = useNotesStore((state) => state.activeNotebookId);
  const setActiveNotebook = useNotesStore((state) => state.setActiveNotebook);
  const navigateToSection = useNotesStore((state) => state.navigateToSection);

  // Flatten all notebooks and sections into searchable items
  const allSearchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    for (const nb of notebooks) {
      const isCurrentNb = nb.id === activeNotebookId;

      // Add all sections for this notebook
      for (const sec of nb.sections) {
        items.push({
          id: `section-${nb.id}-${sec.id}`,
          type: 'section',
          title: sec.name,
          notebookId: nb.id,
          notebookName: nb.name,
          sectionId: sec.id,
          isCurrentNotebook: isCurrentNb,
          isCurrentNotebookSection: isCurrentNb,
        });
      }

      // Add notebook itself
      items.push({
        id: `notebook-${nb.id}`,
        type: 'notebook',
        title: nb.name,
        notebookId: nb.id,
        notebookName: nb.name,
        sectionCount: nb.sections.length,
        isCurrentNotebook: isCurrentNb,
        isCurrentNotebookSection: false,
      });
    }

    return items;
  }, [notebooks, activeNotebookId]);

  // Filter and rank items with fuzzy search and current notebook collision priority
  const results: ScoredSearchItem[] = useMemo(() => {
    return searchAndRankItems(allSearchItems, query);
  }, [allSearchItems, query]);

  // Reset state when opening/closing or when query changes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Small timeout ensures focus after animation frame
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [isOpen]);

  // Keep selected index within bounds and reset to 0 on new query
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view smoothly
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleSelect = (scoredItem?: ScoredSearchItem) => {
    if (!scoredItem) return;
    const item = scoredItem.item;

    if (item.type === 'section' && item.sectionId) {
      navigateToSection(item.notebookId, item.sectionId);
    } else if (item.type === 'notebook') {
      setActiveNotebook(item.notebookId);
    }

    onClose();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const renderTitle = (title: string, indices: number[]) => {
    if (!indices || indices.length === 0) {
      return <span>{title}</span>;
    }

    const indexSet = new Set(indices);
    return (
      <span>
        {title.split('').map((char, idx) => {
          if (indexSet.has(idx)) {
            return (
              <span
                key={idx}
                className="font-bold text-black dark:text-white underline decoration-black/30 dark:decoration-white/30"
              >
                {char}
              </span>
            );
          }
          return <span key={idx}>{char}</span>;
        })}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/15 dark:bg-black/35 backdrop-blur-[2px] animate-fade-in p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] max-h-[82vh] rounded-2xl bg-white/95 dark:bg-[#202020]/98 backdrop-blur-2xl border border-black/[0.08] dark:border-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.28)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden no-drag transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-black/[0.06] dark:border-white/[0.08] gap-3">
          <Search size={18} className="text-gray-400 dark:text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search sections or notebooks…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none font-normal"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium tracking-wide bg-black/[0.05] dark:bg-white/10 text-gray-500 dark:text-gray-400 rounded-md border border-black/[0.06] dark:border-white/10">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[380px] min-h-[140px]"
        >
          {results.length === 0 ? (
            <div className="py-12 px-4 text-center text-gray-400 dark:text-gray-500">
              <Search size={28} className="mx-auto mb-2 opacity-35" />
              <p className="text-xs font-medium">
                No sections or notebooks matching &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            results.map((scored, index) => {
              const item = scored.item;
              const isSelected = index === selectedIndex;
              const isSection = item.type === 'section';

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleSelect(scored)}
                  className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'bg-black/[0.06] dark:bg-white/10 text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    {/* Item icon (monochrome gray / light shades) */}
                    <div className="w-7 h-7 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0 border border-black/[0.03] dark:border-white/[0.05]">
                      {isSection ? (
                        <Layers size={15} strokeWidth={2} />
                      ) : (
                        <NotebookIcon size={15} strokeWidth={2} />
                      )}
                    </div>

                    {/* Item Title & Breadcrumbs */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-[13px] truncate">
                          {renderTitle(item.title, scored.indices)}
                        </span>
                        {item.isCurrentNotebookSection && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/[0.05] dark:bg-white/10 text-gray-600 dark:text-gray-300 border border-black/[0.04] dark:border-white/[0.06] shrink-0">
                            Current Notebook
                          </span>
                        )}
                        {!isSection && item.isCurrentNotebook && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/[0.05] dark:bg-white/10 text-gray-600 dark:text-gray-300 border border-black/[0.04] dark:border-white/[0.06] shrink-0">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {isSection ? (
                          <span>In &ldquo;{item.notebookName}&rdquo;</span>
                        ) : (
                          <span>
                            {item.sectionCount}{' '}
                            {item.sectionCount === 1 ? 'section' : 'sections'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right pill / action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06]">
                      {isSection ? 'Section' : 'Notebook'}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 pl-1">
                        <span>Open</span>
                        <CornerDownLeft size={11} strokeWidth={2.2} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
