import { Notebook, SCHEMA_VERSION } from '../types';
import { getPageBlob, putPageImage } from '../store/imageStore';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, readTextFile } from '@tauri-apps/plugin-fs';

export interface NotebookBundle {
  version: number;
  notebook: Notebook;
  images: Record<string, string>; // imageKey -> base64 string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/jpeg';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

export async function exportNotebookBundle(notebook: Notebook): Promise<void> {
  const images: Record<string, string> = {};

  for (const sec of notebook.sections) {
    for (const el of sec.elements) {
      if (el.type === 'pdf-page' && el.imageKey) {
        const blob = await getPageBlob(el.imageKey);
        if (blob) {
          images[el.imageKey] = await blobToBase64(blob);
        }
      }
    }
  }

  const bundle: NotebookBundle = {
    version: SCHEMA_VERSION,
    notebook,
    images,
  };

  const jsonString = JSON.stringify(bundle, null, 2);
  const defaultFilename = `${notebook.name}.inkwell.json`;

  // @ts-expect-error — Tauri check
  const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

  if (isTauri) {
    const savePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: 'Inkwell Notebook Bundle', extensions: ['inkwell.json', 'json'] }],
    });
    if (savePath) {
      await writeFile(savePath, new TextEncoder().encode(jsonString));
    }
  } else {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function importNotebookBundle(
  filePathOrFile: string | File
): Promise<Notebook> {
  let jsonString = '';

  if (typeof filePathOrFile === 'string') {
    jsonString = await readTextFile(filePathOrFile);
  } else {
    jsonString = await filePathOrFile.text();
  }

  const bundle = JSON.parse(jsonString) as NotebookBundle;
  if (!bundle.notebook || !bundle.notebook.id) {
    throw new Error('Invalid notebook bundle format');
  }

  // Restore images into IndexedDB
  if (bundle.images) {
    for (const [key, base64] of Object.entries(bundle.images)) {
      const blob = base64ToBlob(base64);
      await putPageImage(key, blob);
    }
  }

  return bundle.notebook;
}
