# AGENTS.md — Inkwell: macOS Infinite-Canvas Notebook

> **For the coding agent.** This file is the single source of truth. Read §0 before writing any code.
> Every rule marked **[HARD]** has caused a real first-run failure in this stack. Do not deviate.

---

## 0. Rules of Engagement

1. **Build in the order given in §11.** Each task ends with a *Checkpoint* — a command plus an observable result. Do not start task N+1 until task N's checkpoint passes.
2. **Never invent config files.** The exact contents of every config file are in §4. Copy them verbatim.
3. **Do not upgrade, downgrade, or substitute packages** listed in §3 without saying so explicitly in your reply.
4. **If a command fails, read the error and fix the cause.** Do not work around a failure by deleting the feature.
5. **No placeholder code.** No `// TODO: implement`. No mock data left in the final build.
6. **TypeScript strict mode stays on.** `any` is permitted only in the two places §10 names.
7. After each task, run `npm run build` (type-check + bundle). It must exit 0.

**Working assumption:** developer machine is macOS with Xcode Command Line Tools and a Rust toolchain. This is a desktop app; the browser dev server is a convenience, not the target.

---

## 1. Product Scope

### In scope (v1)
| Feature | Definition of done |
|---|---|
| Infinite canvas | Pan (2-finger scroll / Space+drag / middle-drag), zoom 0.25×–3.0× anchored to cursor, adaptive dot grid |
| PDF printouts | Import a PDF → every page becomes an independent draggable card, stacked vertically |
| Page locking | A locked card cannot be dragged and does not swallow pointer events meant for text on top of it |
| Freeform text | Double-click empty canvas → rich-text block; drag by its handle; font family + size from toolbar |
| Notebook / section hierarchy | Sidebar with notebook switcher, section pills, add/rename/delete section |
| Export to PDF | Bounding box of all elements → paginated PDF saved to disk via native save dialog |
| Offline persistence | Everything survives quit/relaunch, including imported PDF imagery |

### Explicitly out of scope (v1) — do not build
Ink/stylus drawing, collaboration, cloud sync, search, tags, tables, images other than PDF pages, undo across sessions, iCloud, Windows/Linux packaging.

### Ambiguities resolved (the previous draft left these undefined)
- **"Existing notebook"** = open an `.inkwell.json` bundle from disk via native file dialog. It is *import*, not a picker of in-app notebooks. The third card on the start screen and any cards after it are **recent notebooks** already in local storage.
- **"Utility Slot 1 / Slot 2"** in the toolbar are rendered as disabled outlined buttons with `title="Coming soon"`. They are visual placeholders from the wireframe. Do not invent features for them.
- **Selection** is a first-class concept and was missing from the old data model. See §6.
- **Undo** is in-session only (§9.6), 50 steps, `Cmd+Z` / `Cmd+Shift+Z`.

---

## 2. Prerequisites & Bootstrap

```bash
# Verify toolchain first — do not skip
node -v          # must be >= 20.19 (Vite 7 / Tailwind 4 requirement)
rustc --version  # must exist; if not: https://rustup.rs
xcode-select -p  # must print a path
```

**[HARD] Scaffold with the Tauri template, not the bare Vite template.**
The previous draft's Task 1 produced a web app with no `src-tauri/`, no Rust crate, and no way to run `tauri dev`. That alone made the plan unbuildable as a desktop app.

```bash
npm create tauri-app@latest inkwell -- --template react-ts --manager npm
cd inkwell
npm install
npm run tauri dev   # must open a native window before you write any feature code
```

This gives you `src-tauri/` (Cargo project, `tauri.conf.json`), a Vite config already wired for Tauri's dev server, and correct `build.target`/`server` settings. Keep them.

---

## 3. Locked Dependency Set

```bash
# UI + styling
npm install tailwindcss @tailwindcss/vite lucide-react clsx tailwind-merge

# state
npm install zustand idb-keyval

# pdf in / pdf out
npm install pdfjs-dist jspdf html2canvas-pro

# rich text (TipTap v3 — TextStyleKit ships FontFamily AND FontSize)
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-text-style

# native plugins
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-fs @tauri-apps/plugin-opener
npm run tauri add dialog
npm run tauri add fs
```

### Substitutions from the previous draft, and why

| Was | Now | Reason |
|---|---|---|
| `html2canvas` | **`html2canvas-pro`** | **[HARD]** Tailwind v4 emits its entire default palette in `oklch()`. `html2canvas@1.4.1` throws `Attempting to parse an unsupported color function "oklch"` the moment it meets any default Tailwind color utility, and it is unmaintained. `html2canvas-pro` is the maintained fork with `oklch()`/`oklab()`/`lab()`/`color()` support. Export would have failed on the first click. |
| TipTap v2 + `@tiptap/extension-font-family` | **TipTap v3 `@tiptap/extension-text-style`** | v3 bundles `FontFamily` *and* `FontSize` inside `TextStyleKit`. The old plan listed a font-*family* extension and then required a font-*size* control that has no v2 equivalent — the agent would have had to hand-roll a ProseMirror mark, which is exactly where first-pass builds die. |
| *(nothing)* | **`idb-keyval`** | See §7. Rasterized pages cannot live in `localStorage`. |
| *(nothing)* | **`@tiptap/pm`** | Required peer of `@tiptap/react`; omitting it yields a confusing `prosemirror-state` duplicate-instance error. |

### Do **not** install
`tailwind.config.js`, `postcss`, `autoprefixer`, `html2canvas` (classic), `react-dnd`, `react-draggable`, `fabric`, `konva`. Dragging is ~40 lines of pointer-event code (§8.4) and a library will fight the zoom transform.

---

## 4. Config Files — Verbatim

### `vite.config.ts`
Keep whatever `create-tauri-app` generated and **add** the Tailwind plugin, `optimizeDeps`, and the esnext target:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // [HARD] pdfjs-dist v5 is ESM-first and uses top-level await.
  // Without these two blocks the dev server 500s on the first import.
  optimizeDeps: {
    include: ['pdfjs-dist'],
    esbuildOptions: { target: 'esnext', supported: { 'top-level-await': true } },
  },
  build: { target: 'esnext' },

  // Tauri expects a fixed port and wants Vite's own errors visible
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
}));
```

**[HARD] There is no `tailwind.config.js` and no `postcss.config.js` in this project.** Tailwind v4 is configured in CSS. If you create either file, the build silently produces unstyled output.

### `src/index.css`

```css
@import "tailwindcss";

@theme {
  --color-canvas:        #FAFAFA;
  --color-chrome:        #D5D7DA;
  --color-sidebar:       #E5E7EB;
  --color-pill:          #9CA3AF;
  --color-pill-active:   #4B5563;
  --color-stroke:        #6B7280;
  --color-dot:           #A3A8B0;

  --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

@layer base {
  html, body, #root {
    height: 100%;
    margin: 0;
    overflow: hidden;              /* the canvas owns all scrolling */
    overscroll-behavior: none;     /* kills macOS rubber-band / swipe-back */
    font-family: var(--font-ui);
    background: var(--color-canvas);
  }
  body {
    user-select: none;
    -webkit-user-select: none;
    cursor: default;
  }
  input, textarea, [contenteditable="true"] {
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  }
  .ProseMirror:focus { outline: none; }
}

/* Native macOS traffic-light clearance when titleBarStyle is Overlay */
.titlebar-pad { padding-top: 28px; }
.drag-region  { -webkit-app-region: drag; }
.no-drag      { -webkit-app-region: no-drag; }
```

### `src-tauri/tauri.conf.json` (relevant keys)

```jsonc
{
  "productName": "Inkwell",
  "identifier": "com.inkwell.app",
  "app": {
    "windows": [{
      "title": "Inkwell",
      "width": 1280,
      "height": 840,
      "minWidth": 900,
      "minHeight": 600,
      "titleBarStyle": "Overlay",
      "hiddenTitle": true,
      "resizable": true
    }],
    "security": {
      // [HARD] pdfjs spawns its worker from a blob: URL and rendered pages are
      // blob: object URLs. A restrictive CSP breaks both with an opaque
      // "Failed to fetch dynamically imported module".
      "csp": "default-src 'self'; img-src 'self' data: blob: asset: http://asset.localhost; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost blob: data:"
    }
  }
}
```

### `src-tauri/capabilities/default.json`

**[HARD]** Tauri v2 denies plugin commands unless a capability grants them. Missing permissions surface as `Unhandled Promise Rejection: dialog.save not allowed`, which reads like a bug in your code.

```jsonc
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read-file",
    "fs:allow-write-file",
    { "identifier": "fs:scope", "allow": [{ "path": "$HOME/**" }, { "path": "$DOWNLOAD/**" }, { "path": "$DOCUMENT/**" }] }
  ]
}
```

---

## 5. Design System

Taken from the three wireframes. Values are exact; do not "improve" them.

```
Canvas surface .............. #FAFAFA, radial dot grid in #A3A8B0
Chrome / modal / toolbar .... #D5D7DA
Sidebar ..................... #E5E7EB, border-right #D1D5DB
Section pill (inactive) ..... #9CA3AF, white text
Section pill (active) ....... #4B5563, white text
Outlines .................... #6B7280 at 1.5px
Primary button .............. white fill, black text
Radii ....................... cards 1rem · pills 0.75rem · modal 1.5rem
```

### Screen 1 — Start (`start_screen.png`)
Top-aligned horizontal row of cards, `px-20 pt-16`, `gap-5`, with `.titlebar-pad` so the first card clears the traffic lights.
- Card: `w-[280px] h-[205px] rounded-2xl bg-chrome hover:brightness-[0.97] transition cursor-pointer`. Content sits at `p-6`, **top-left**, vertically around 40% down — match the wireframe, not a centered layout.
- Card 1: `<PlusCircle size={26} strokeWidth={1.75}/>` + `New Notebook` (`text-base`).
- Card 2: `Existing notebook`.
- Cards 3…n: recent notebooks — name at the same position, `createdAt` relative date beneath in `text-xs text-gray-600`. An empty third card renders only when there are no recents (matches wireframe).

### Screen 2 — Create dialog (`dialog-box.png`)
Backdrop `fixed inset-0 bg-black/10 backdrop-blur-[2px]`. The start screen stays visible behind it.
- Card: `w-[520px] rounded-3xl bg-chrome px-12 py-10 shadow-xl`.
- Row: label `Name` (`text-3xl font-normal`) + input `flex-1 h-12 rounded-xl bg-transparent border-[1.5px] border-black/70 px-4 text-lg focus:outline-none focus:ring-2 focus:ring-black/20`.
- Gap of `~3.5rem` between the row and the button (the wireframe has a lot of air here).
- Button: `w-full bg-[#F7F7F7] text-black text-3xl font-normal py-5 rounded-2xl hover:bg-white active:scale-[0.995] transition disabled:opacity-40` reading `Create`. Disabled while the name is blank. `Enter` submits, `Esc` closes.

### Screen 3 — Workspace (`main_screen.png`)
- **Sidebar** `w-[300px] bg-sidebar border-r border-gray-300 px-4 pt-3`, with `.titlebar-pad`.
  - Header row: `Notebook Name ⌵` (`text-xl`) + right-aligned `<PanelLeft size={24}/>` toggle. Collapsing animates width to 0 and reveals a floating `<PanelLeft/>` at `top-4 left-4`.
  - Pills: `w-full h-[52px] rounded-xl mb-3 px-5 text-left text-white text-lg`, `bg-pill`, active `bg-pill-active`. Double-click a pill to rename inline.
  - Empty pills in the wireframe are real sections with blank names — render them as `bg-pill` with no label. `+ Add Section` sits under the list, `text-gray-600 text-sm`.
- **Floating toolbar** `absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl bg-chrome/95 backdrop-blur-md px-4 py-3 shadow-sm`. Note the wireframe's toolbar is centered over the *canvas area*, not the whole window — when the sidebar is open, center within the canvas region.
  - `Add pdf`: `px-8 py-2.5 rounded-xl border-[1.5px] border-stroke hover:bg-black/5`.
  - Two disabled square slots: `w-[60px] h-[42px] rounded-xl border-[1.5px] border-stroke opacity-60`.
  - Segmented control: one `rounded-xl border-[1.5px] border-stroke` container holding the font-family select (`Times New Roman`, `Inter`, `System`, `Fira Code`) and the size select (`14, 16, 18, 24, 32, 48`), separated by a `border-l`. Use native `<select>` with `appearance-none` plus a `<ChevronDown size={16}/>` — native menus feel correct on macOS and cost nothing.
  - `<MoreVertical size={20}/>` opens: *Export as PDF*, *Reset View*, *Clear Canvas* (with confirm).
- **Canvas** fills the remainder. Dot grid per §8.3.

---

## 6. Data Model

`src/types.ts`:

```ts
export const SCHEMA_VERSION = 1;

export interface Notebook {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sections: Section[];
}

export interface Section {
  id: string;
  name: string;
  viewport: Viewport;
  elements: CanvasElement[];
}

export interface Viewport { x: number; y: number; zoom: number }

export interface BaseElement {
  id: string;
  x: number;          // canvas-space, NOT screen-space
  y: number;
  zIndex: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  width: number;
  height: number | null;   // null = auto-grow
  content: string;         // TipTap HTML
  fontFamily: string;
  fontSize: number;
}

export interface PdfPageElement extends BaseElement {
  type: 'pdf-page';
  pdfId: string;           // groups pages from one import
  pdfName: string;
  pageNumber: number;
  totalPages: number;
  width: number;           // canvas-space CSS px at zoom 1
  height: number;
  imageKey: string;        // IndexedDB key — NOT a data URL. See §7.
  isLocked: boolean;
}

export type CanvasElement = TextElement | PdfPageElement;

/** Transient — never persisted */
export interface UiState {
  selectedId: string | null;
  editingId: string | null;
  isSidebarOpen: boolean;
  isImporting: boolean;
  importProgress: { done: number; total: number } | null;
}
```

**Change from the previous draft:** `dataUrl: string` became `imageKey: string`, and `selectedId` now exists. The old model made acceptance criterion 6 ("select a text card and change its font from the toolbar") literally unimplementable — there was no selection state to read.

---

## 7. Storage Architecture — **read this before Task 2**

**[HARD] The previous plan would have crashed on the first PDF import.** It put base64 PNG data URLs inside a Zustand `persist` store. `persist` defaults to `localStorage`, which has a ~5 MB per-origin quota. One 10-page PDF rasterized to PNG at 1.5× is roughly 15–40 MB of base64. The result is a `QuotaExceededError` thrown from inside the persist middleware, which Zustand swallows — so the app *appears* to work until relaunch, when every page is silently gone.

### The split

**Metadata → `localStorage` via `persist`.** Notebooks, sections, element geometry, text content. Small, synchronous, easy to migrate.

**Page imagery → IndexedDB via `idb-keyval`, as `Blob`s.** Not base64.

```ts
// src/store/imageStore.ts
import { get, set, del, keys } from 'idb-keyval';

const urlCache = new Map<string, string>();

export async function putPageImage(key: string, blob: Blob) {
  await set(key, blob);
}

/** Returns an object URL, memoised. Safe to call during render via useEffect. */
export async function getPageImageUrl(key: string): Promise<string | null> {
  const cached = urlCache.get(key);
  if (cached) return cached;
  const blob = await get<Blob>(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export async function deletePageImage(key: string) {
  const url = urlCache.get(key);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(key); }
  await del(key);
}

/** Run once on app start: drop IDB blobs no element references anymore. */
export async function collectGarbage(liveKeys: Set<string>) {
  for (const k of await keys()) {
    if (typeof k === 'string' && k.startsWith('page:') && !liveKeys.has(k)) await del(k);
  }
}
```

Rasterize to **JPEG at quality 0.82**, not PNG — a typical text page drops from ~2.2 MB to ~180 KB with no visible loss at 1.5×. Use `canvas.toBlob(cb, 'image/jpeg', 0.82)`.

### Persist configuration

```ts
persist(storeCreator, {
  name: 'inkwell-v1',
  version: SCHEMA_VERSION,
  partialize: (s) => ({ notebooks: s.notebooks, activeNotebookId: s.activeNotebookId, activeSectionId: s.activeSectionId }),
  migrate: (persisted, version) => {
    if (version < 1) return { notebooks: [], activeNotebookId: null, activeSectionId: null };
    return persisted as never;
  },
  onRehydrateStorage: () => (state, error) => {
    // "automatic schema recovery" means: on corrupt state, reset rather than white-screen
    if (error) { localStorage.removeItem('inkwell-v1'); location.reload(); }
  },
})
```

---

## 8. Canvas Mathematics

The world layer is a single element with `transform: translate(Xpx, Ypx) scale(Z)` and `transform-origin: 0 0`. Every element inside is positioned at its canvas-space `x/y` in plain `px`. Nothing else applies a transform.

### 8.1 Screen ↔ canvas

```
canvasX = (screenX - viewport.x) / viewport.zoom
canvasY = (screenY - viewport.y) / viewport.zoom

screenX = canvasX * viewport.zoom + viewport.x
screenY = canvasY * viewport.zoom + viewport.y
```

`screenX/screenY` must be measured **relative to the canvas container's bounding rect**, not the window — otherwise the sidebar width offsets everything.

### 8.2 Zoom anchored to the cursor

The old spec asked for cursor-anchored zoom but never gave the formula, which is where drift comes from:

```ts
const next = clamp(zoom * Math.exp(-deltaY * 0.01), 0.25, 3);
const k = next / zoom;
viewport.x = px - k * (px - viewport.x);   // px, py = cursor, container-relative
viewport.y = py - k * (py - viewport.y);
viewport.zoom = next;
```

### 8.3 Dot grid

```ts
const spacing = 28 * zoom;
style = {
  backgroundImage: `radial-gradient(circle, var(--color-dot) ${Math.max(0.6, 1.2 * zoom)}px, transparent ${Math.max(0.6, 1.2 * zoom)}px)`,
  backgroundSize: `${spacing}px ${spacing}px`,
  backgroundPosition: `${viewport.x % spacing}px ${viewport.y % spacing}px`,
};
```

The grid lives on the **static container**, not inside the transformed world layer — transforming a background gradient is expensive and blurs at high zoom.

### 8.4 Dragging

```
dx_canvas = (e.clientX - lastX) / zoom
dy_canvas = (e.clientY - lastY) / zoom
```

Use `pointerdown` + `setPointerCapture` + `pointermove` + `pointerup`. Never `mousemove` on `window` — pointer capture is what keeps the drag alive when the cursor leaves the card.

---

## 9. Behaviour Contracts

### 9.1 Input map
| Gesture | Effect |
|---|---|
| 2-finger trackpad scroll | Pan: `x -= e.deltaX`, `y -= e.deltaY` |
| Pinch, or Ctrl/Cmd + wheel | Zoom (§8.2) |
| Space held + drag, or middle-drag | Pan |
| Double-click empty canvas | New `TextElement` at that canvas point, focused |
| Click element | Select |
| Double-click text element | Enter edit mode |
| Click empty canvas | Deselect, exit edit |
| `Esc` | Exit edit → deselect |
| `Delete` / `Backspace` while selected, not editing | Delete element (+ its IDB blob) |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / redo |
| `Cmd+0` | Reset view to `{x:0,y:0,zoom:1}` |

### 9.2 PDF import
1. `<input type="file" accept="application/pdf">`, hidden, triggered by *Add pdf*.
2. `file.arrayBuffer()` → `getDocument({ data })`.
3. Show a progress pill (`Rendering page 3 of 24…`) while looping. Import is async and must not block panning.
4. Per page: `getViewport({ scale: 1.5 * Math.min(devicePixelRatio, 2) })`, render to an offscreen canvas, `toBlob('image/jpeg', 0.82)`, `putPageImage`.
5. Card size in canvas space is the page at `scale: 1` (so zoom, not raster scale, controls apparent size).
6. Stack pages vertically with a 40px gutter, horizontally centered on the current viewport center, starting 60px below it.
7. `zIndex` ascends; PDF pages always sit below text (`zIndex` base 0 for pages, base 1000 for text).

### 9.3 Page locking
`isLocked: true` → the card's image layer gets `pointer-events: none` so a double-click lands on the canvas beneath and creates a text note *on top of* the page. The header bar keeps `pointer-events: auto` so the lock can be released. This is the whole point of the feature; get it right.

### 9.4 Text cards
- TipTap `useEditor` with `StarterKit` + `TextStyleKit`.
- Font family and size are stored on the element **and** applied to the editor root as CSS, so an un-selected run still renders correctly.
- Toolbar change with a selection inside the editor → `editor.chain().focus().setFontSize('24px').run()`. Toolbar change with a card selected but not editing → apply to the whole element and re-render.
- A text card with empty content is deleted on blur.

### 9.5 Export to PDF
1. Compute the bounding box of all elements (+ 48px margin).
2. Clone the world layer into an off-screen container at `zoom: 1`, `translate(0,0)`, sized to the bounding box. **Do not screenshot the live transformed node** — `html2canvas-pro` rasterizes the transform and you get a cropped, scaled mess.
3. `html2canvas-pro(clone, { scale: 2, backgroundColor: '#FFFFFF', useCORS: true })`.
4. Slice the resulting canvas into A4-proportioned bands, `doc.addImage` each into a `jsPDF` page.
5. `doc.output('arraybuffer')` → `save()` from `@tauri-apps/plugin-dialog` → `writeFile` from `@tauri-apps/plugin-fs`. Default filename `${notebook.name} — ${section.name}.pdf`.
6. If `window.__TAURI_INTERNALS__` is undefined (running in a plain browser), fall back to `doc.save(name)`.

### 9.6 Undo
A plain in-memory ring buffer of `Section.elements` snapshots, capped at 50, pushed on every mutating action except live drag deltas (push once on `pointerup`). Not persisted.

---

## 10. Pitfalls — Ranked by How Badly They Burn

### P1 — `localStorage` quota on PDF import *(fatal, silent)*
Covered in §7. This is the single most likely cause of a build that demos fine and loses all data on relaunch.

### P2 — `html2canvas` + Tailwind v4 `oklch()` *(fatal, first click)*
`Attempting to parse an unsupported color function "oklch"`. Use `html2canvas-pro`. Never import `html2canvas`.

### P3 — React's wheel listener is passive *(pinch-zoom zooms the whole app)*
React attaches `wheel` at the root as a passive listener, so `e.preventDefault()` inside `onWheel` does nothing and macOS zooms the WebView instead of your canvas.

```ts
useEffect(() => {
  const el = containerRef.current!;
  const onWheel = (e: WheelEvent) => { e.preventDefault(); /* pan or zoom */ };
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => el.removeEventListener('wheel', onWheel);
}, []);
```

Also swallow WebKit's legacy gesture events, or the trackpad pinch will zoom the page:

```ts
['gesturestart', 'gesturechange', 'gestureend'].forEach(t =>
  el.addEventListener(t, (e) => e.preventDefault())
);
```

On macOS a trackpad pinch arrives as a `wheel` event with `ctrlKey === true`. Branch on `e.ctrlKey || e.metaKey` for zoom, else pan.

### P4 — `pdfjs-dist` worker
```ts
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
```
Set this **at module scope**, before any `getDocument` call. Combined with the `optimizeDeps` block in §4 and the `worker-src blob:` CSP in `tauri.conf.json`. If you see `Setting up fake worker failed`, one of those three is missing.

### P5 — Tauri capabilities
A missing entry in `capabilities/default.json` makes `save()` and `writeFile()` reject with a permissions error, not a crash. Verify §4's file exists before implementing export.

### P6 — Event bubbling: drag vs. edit
`pointerdown` on a text card body or a PDF card header must call `e.stopPropagation()`. Otherwise the canvas treats it as a pan and the element slides while you try to place a caret. Conversely, `pointerdown` inside an *active* TipTap editor must **not** be intercepted at all — let the browser place the caret.

### P7 — Stale closures in drag handlers
Drag math reads `viewport.zoom`. If you capture it in the `pointerdown` closure it goes stale after a zoom mid-drag. Read it from a `useRef` mirrored off the store, or from `useNotesStore.getState()` inside the move handler.

### P8 — Re-render storms
Selecting the whole store re-renders every card on every pointer move. Use narrow selectors (`useNotesStore(s => s.activeSection?.elements)`), and hold live drag position in local component state, committing to the store only on `pointerup`.

### P9 — `Promise.withResolvers`
`pdfjs-dist` v5 uses it. macOS WebKit has it from Safari 17.4 (macOS 14.4+). If the target is older, add this polyfill in `main.tsx` before any other import:
```ts
// @ts-expect-error — polyfill for WKWebView < 17.4
if (!Promise.withResolvers) Promise.withResolvers = function () {
  let resolve: any, reject: any;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
```
This and the `html2canvas-pro` options object are the only two places `any` is allowed.

### P10 — Object URL leaks
Every `URL.createObjectURL` needs a matching `revokeObjectURL` on element delete and on section switch. The `urlCache` in §7 is the only place that may call it.

### P11 — Traffic lights over content
`titleBarStyle: "Overlay"` puts the window controls on top of your UI. The start-screen cards and the sidebar header both need `.titlebar-pad`. Check against `start_screen.png` — the wireframe's cards start well below the top edge.

### P12 — `user-select: none` kills text editing
The global rule in §5 must be paired with the `input, textarea, [contenteditable]` override, or TipTap becomes unselectable and copy/paste dies.

---

## 11. Task List

Each task ends with a checkpoint. Do not proceed past a failing checkpoint.

```markdown
- [ ] T1 — Shell
      create-tauri-app scaffold, deps from §3, configs from §4 verbatim.
      Delete the template's demo component and CSS.
      CHECKPOINT: `npm run tauri dev` opens a native window with a #FAFAFA
      background and zero console errors. `npm run build` exits 0.

- [ ] T2 — Types & store  (src/types.ts, src/store/useNotesStore.ts, src/store/imageStore.ts)
      Types from §6. Zustand + persist configured exactly as §7 (partialize,
      version, migrate, onRehydrateStorage). idb-keyval helpers.
      Actions: createNotebook, deleteNotebook, setActiveNotebook, addSection,
      renameSection, deleteSection, setActiveSection, addElement, updateElement,
      moveElement, deleteElement, setViewport, undo, redo.
      CHECKPOINT: in devtools, createNotebook() then reload — the notebook is
      still there, and localStorage holds only metadata (< 50 KB).

- [ ] T3 — Start screen + create dialog  (components/Screens/)
      §5 screens 1 and 2 pixel-matched. Recent notebooks from the store.
      "Existing notebook" wired to dialog.open() with a .json filter (import
      lands in T9; for now, log the path).
      CHECKPOINT: side-by-side with start_screen.png and dialog-box.png —
      card sizes, corner radii, text positions, and the modal's generous
      internal spacing all match. Create → app transitions to the workspace.

- [ ] T4 — Canvas viewport  (components/Canvas/Canvas.tsx, utils/canvasMath.ts)
      Non-passive wheel listener (P3), pan, cursor-anchored zoom (§8.2),
      Space+drag, dot grid (§8.3), viewport persisted per section.
      CHECKPOINT: pan is smooth with no stutter; pinch-zoom keeps the point
      under the cursor fixed to within a pixel at 0.25× and at 3.0×; the
      window itself never zooms; the grid never visibly seams.

- [ ] T5 — Text cards  (components/Canvas/TextCard.tsx)
      Double-click to create at the correct canvas point (§8.1). TipTap with
      StarterKit + TextStyleKit. Drag, select, edit, delete-on-empty-blur.
      CHECKPOINT: create a card at 0.4× zoom and again at 2.5× zoom — both
      appear exactly under the cursor. Dragging tracks the cursor 1:1 at every
      zoom level. Typing never moves the card.

- [ ] T6 — PDF import  (utils/pdfProcessor.ts, components/Canvas/PdfPageCard.tsx)
      §9.2 pipeline, JPEG blobs to IDB, progress UI, card header with
      "p. 3 / 24" badge + drag handle + lock toggle. §9.3 lock semantics.
      CHECKPOINT: import a 20-page PDF. All 20 cards appear stacked; each drags
      independently; localStorage is still under 100 KB; quit and relaunch and
      every page still renders. Lock a page, double-click it, type — the note
      lands on top of the page.

- [ ] T7 — Sidebar  (components/Layout/Sidebar.tsx)
      §5 screen 3 sidebar. Notebook dropdown, section pills with active state,
      inline rename on double-click, + Add Section, collapse/expand.
      CHECKPOINT: matches main_screen.png. Switching sections swaps elements
      and restores that section's saved viewport.

- [ ] T8 — Toolbar  (components/Layout/FloatingToolbar.tsx)
      §5 toolbar. Add pdf, two disabled slots, segmented font controls bound to
      the selected element (§9.4), overflow menu.
      CHECKPOINT: select a text card, change size 14 → 48 — the card updates
      immediately and the change survives reload. Toolbar stays centered over
      the canvas region when the sidebar collapses.

- [ ] T9 — Export, import, polish  (utils/exportPdf.ts, utils/bundle.ts)
      §9.5 export via off-screen zoom-1 clone. Notebook export/import as
      .inkwell.json (images base64'd only in the bundle file, never in the
      store). Undo (§9.6). Keyboard map (§9.1). collectGarbage() on boot.
      CHECKPOINT: export a canvas holding 3 PDF pages and 4 text notes —
      the PDF opens in Preview, is readable, and nothing is clipped.

- [ ] T10 — Release
      `npm run tauri build`. Verify the .app launches from /Applications and
      the window chrome looks native.
      CHECKPOINT: run the full §13 script against the installed app.
```

---

## 12. File Structure

```text
inkwell/
├── src/
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── Canvas.tsx           # viewport, wheel/pointer handling, dot grid, dblclick
│   │   │   ├── WorldLayer.tsx       # the single transformed node
│   │   │   ├── PdfPageCard.tsx      # draggable + lockable page
│   │   │   └── TextCard.tsx         # TipTap container
│   │   ├── Layout/
│   │   │   ├── FloatingToolbar.tsx
│   │   │   └── Sidebar.tsx
│   │   └── Screens/
│   │       ├── StartScreen.tsx
│   │       └── CreateNotebookDialog.tsx
│   ├── store/
│   │   ├── useNotesStore.ts         # zustand + persist (metadata only)
│   │   ├── useUiStore.ts            # selection, editing, transient flags
│   │   └── imageStore.ts            # idb-keyval blobs + object-URL cache
│   ├── utils/
│   │   ├── canvasMath.ts
│   │   ├── pdfProcessor.ts
│   │   ├── exportPdf.ts
│   │   └── bundle.ts                # .inkwell.json export / import
│   ├── types.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── src-tauri/
│   ├── capabilities/default.json
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── src/lib.rs                   # register dialog + fs plugins
├── package.json
├── tsconfig.json
└── vite.config.ts
```

No `tailwind.config.js`. No `postcss.config.js`.

---

## 13. Acceptance Script

Run every step against the built `.app`. A single failure means the build is not done.

1. **Cold start** → start screen, cards match `start_screen.png`, traffic lights overlap nothing.
2. **New Notebook** → modal matches `dialog-box.png`; `Create` is disabled until a name is typed; `Enter` submits; workspace opens.
3. **Pan** with 2-finger scroll for 5 seconds — no stutter, no rubber-band, no back-swipe.
4. **Zoom** to 3.0× and back to 0.25× — the point under the cursor stays fixed; the app window itself never scales.
5. **Add pdf** with a 20+ page document — progress indicator shows, pages stack vertically, the UI stays responsive during import.
6. **Drag page 7** away from the stack. It moves alone.
7. **Lock page 7**, double-click on top of it, type a note. The note appears over the page. Unlock — the page drags again.
8. **Select a text card**, change the font to Fira Code and the size to 48. Applied instantly.
9. **Add a second section**, switch to it (empty canvas, own viewport), switch back — everything is where you left it, at the zoom you left it.
10. **Quit and relaunch.** Every notebook, section, text note, and PDF page image is present. `localStorage` is still under 100 KB.
11. **Export as PDF** → native save dialog → the file opens in Preview, is readable, nothing clipped at the edges.
12. **Cmd+Z** five times after five edits — each one reverses cleanly.
13. **Console is clean.** No errors, no React key warnings, no object-URL leak warnings.
