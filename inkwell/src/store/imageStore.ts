import { get, set, del, keys } from 'idb-keyval';
import {
  saveImageToDisk,
  loadImageFromDisk,
  deleteImageFromDisk,
} from '../services/storageService';

const urlCache = new Map<string, string>();

export async function putPageImage(key: string, blob: Blob) {
  // Save to IndexedDB for quick local access
  await set(key, blob);
  // Also persist to ~/Documents/Notebook/images/ so it survives app reinstalls
  saveImageToDisk(key, blob).catch((err) => {
    console.warn('[ImageStore] Failed to persist image to Documents:', err);
  });
}

/** Returns an object URL, memoised. Safe to call during render via useEffect. */
export async function getPageImageUrl(key: string): Promise<string | null> {
  const cached = urlCache.get(key);
  if (cached) return cached;

  let blob = await get<Blob>(key);
  if (!blob) {
    // If not found in IndexedDB (e.g., after app reinstall), recover from Documents
    blob = (await loadImageFromDisk(key)) ?? undefined;
    if (blob) {
      await set(key, blob);
    }
  }

  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export async function getPageBlob(key: string): Promise<Blob | null> {
  let blob = await get<Blob>(key);
  if (!blob) {
    blob = (await loadImageFromDisk(key)) ?? undefined;
    if (blob) {
      await set(key, blob);
    }
  }
  return blob ?? null;
}

export async function deletePageImage(key: string) {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
  await del(key);
  await deleteImageFromDisk(key);
}

/** Run once on app start: drop IDB blobs no element references anymore. */
export async function collectGarbage(liveKeys: Set<string>) {
  for (const k of await keys()) {
    if (
      typeof k === 'string' &&
      (k.startsWith('page:') || k.startsWith('img:')) &&
      !liveKeys.has(k)
    ) {
      await del(k);
    }
  }
}

export function revokeAllCachedUrls() {
  for (const [, url] of urlCache) {
    URL.revokeObjectURL(url);
  }
  urlCache.clear();
}
