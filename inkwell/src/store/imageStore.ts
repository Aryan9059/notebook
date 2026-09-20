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

export async function getPageBlob(key: string): Promise<Blob | null> {
  const blob = await get<Blob>(key);
  return blob ?? null;
}

export async function deletePageImage(key: string) {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
  await del(key);
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
