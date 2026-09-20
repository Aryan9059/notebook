import {
  BaseDirectory,
  mkdir,
  exists,
  readTextFile,
  writeTextFile,
  readFile,
  writeFile,
  remove,
} from '@tauri-apps/plugin-fs';
import { Notebook } from '../types';

const ROOT_DIR = 'Notebook';
const IMAGES_DIR = 'Notebook/images';
const METADATA_FILE = 'Notebook/notebooks.json';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
}

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Initializes the ~/Documents/Notebook directory structure.
 * Creates Notebook/ and Notebook/images/ if they don't already exist.
 */
export async function initDocumentsStorage(): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false;
  }

  try {
    const rootExists = await exists(ROOT_DIR, { baseDir: BaseDirectory.Document });
    if (!rootExists) {
      await mkdir(ROOT_DIR, { baseDir: BaseDirectory.Document, recursive: true });
    }

    const imagesExists = await exists(IMAGES_DIR, { baseDir: BaseDirectory.Document });
    if (!imagesExists) {
      await mkdir(IMAGES_DIR, { baseDir: BaseDirectory.Document, recursive: true });
    }

    return true;
  } catch (err) {
    console.error('[StorageService] Failed to init documents storage:', err);
    return false;
  }
}

/**
 * Saves all notebooks and section metadata to ~/Documents/Notebook/notebooks.json
 */
export async function saveNotebooksToDisk(notebooks: Notebook[]): Promise<boolean> {
  if (!isTauriEnvironment()) return false;

  try {
    await initDocumentsStorage();
    const data = JSON.stringify(
      {
        version: 1,
        savedAt: Date.now(),
        notebooks,
      },
      null,
      2
    );
    await writeTextFile(METADATA_FILE, data, { baseDir: BaseDirectory.Document });
    return true;
  } catch (err) {
    console.error('[StorageService] Failed to save notebooks to disk:', err);
    return false;
  }
}

/**
 * Loads all notebooks from ~/Documents/Notebook/notebooks.json
 */
export async function loadNotebooksFromDisk(): Promise<Notebook[] | null> {
  if (!isTauriEnvironment()) return null;

  try {
    const hasFile = await exists(METADATA_FILE, { baseDir: BaseDirectory.Document });
    if (!hasFile) return null;

    const raw = await readTextFile(METADATA_FILE, { baseDir: BaseDirectory.Document });
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.notebooks)) {
      return parsed.notebooks as Notebook[];
    }
    return null;
  } catch (err) {
    console.error('[StorageService] Failed to load notebooks from disk:', err);
    return null;
  }
}

/**
 * Saves an image/PDF page blob to ~/Documents/Notebook/images/<key>.jpg
 */
export async function saveImageToDisk(key: string, blob: Blob): Promise<boolean> {
  if (!isTauriEnvironment()) return false;

  try {
    await initDocumentsStorage();
    const safeName = `${sanitizeKey(key)}.jpg`;
    const targetPath = `${IMAGES_DIR}/${safeName}`;
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(targetPath, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.Document });
    return true;
  } catch (err) {
    console.error(`[StorageService] Failed to save image ${key} to disk:`, err);
    return false;
  }
}

/**
 * Loads an image from ~/Documents/Notebook/images/<key>.jpg as a Blob
 */
export async function loadImageFromDisk(key: string): Promise<Blob | null> {
  if (!isTauriEnvironment()) return null;

  try {
    const safeName = `${sanitizeKey(key)}.jpg`;
    const targetPath = `${IMAGES_DIR}/${safeName}`;
    const fileExists = await exists(targetPath, { baseDir: BaseDirectory.Document });
    if (!fileExists) return null;

    const bytes = await readFile(targetPath, { baseDir: BaseDirectory.Document });
    return new Blob([bytes], { type: 'image/jpeg' });
  } catch (err) {
    console.error(`[StorageService] Failed to load image ${key} from disk:`, err);
    return null;
  }
}

/**
 * Deletes an image file from ~/Documents/Notebook/images/<key>.jpg
 */
export async function deleteImageFromDisk(key: string): Promise<void> {
  if (!isTauriEnvironment()) return;

  try {
    const safeName = `${sanitizeKey(key)}.jpg`;
    const targetPath = `${IMAGES_DIR}/${safeName}`;
    const fileExists = await exists(targetPath, { baseDir: BaseDirectory.Document });
    if (fileExists) {
      await remove(targetPath, { baseDir: BaseDirectory.Document });
    }
  } catch (err) {
    console.warn(`[StorageService] Failed to delete image ${key} from disk:`, err);
  }
}
