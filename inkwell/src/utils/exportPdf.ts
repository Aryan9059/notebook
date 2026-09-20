import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { CanvasElement } from '../types';

export async function exportSectionToPdf(
  elements: CanvasElement[],
  notebookName: string,
  sectionName: string
): Promise<void> {
  if (elements.length === 0) {
    alert('Canvas is empty. Add text or PDF pages before exporting.');
    return;
  }

  // 1. Calculate bounding box of all elements (+ 48px margin)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    if (el.type === 'arrow') {
      const minArrowX = Math.min(el.startX, el.endX) - 30;
      const maxArrowX = Math.max(el.startX, el.endX) + 30;
      const minArrowY = Math.min(el.startY, el.endY) - 30;
      const maxArrowY = Math.max(el.startY, el.endY) + 30;
      minX = Math.min(minX, minArrowX);
      minY = Math.min(minY, minArrowY);
      maxX = Math.max(maxX, maxArrowX);
      maxY = Math.max(maxY, maxArrowY);
    } else {
      const elWidth = el.width || 320;
      const elHeight = el.type === 'pdf-page' ? el.height + 34 : el.height || 180;
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + elWidth);
      maxY = Math.max(maxY, el.y + elHeight);
    }
  }

  const margin = 48;
  const bboxX = minX - margin;
  const bboxY = minY - margin;
  const bboxWidth = Math.max(100, maxX - minX + margin * 2);
  const bboxHeight = Math.max(100, maxY - minY + margin * 2);

  // 2. Clone world layer into off-screen container at zoom: 1 (§9.5)
  const offscreenContainer = document.createElement('div');
  offscreenContainer.style.position = 'fixed';
  offscreenContainer.style.left = '-99999px';
  offscreenContainer.style.top = '0';
  offscreenContainer.style.width = `${Math.ceil(bboxWidth)}px`;
  offscreenContainer.style.height = `${Math.ceil(bboxHeight)}px`;
  offscreenContainer.style.backgroundColor = '#FFFFFF';
  offscreenContainer.style.overflow = 'hidden';
  offscreenContainer.style.zIndex = '-9999';

  for (const el of elements) {
    const domEl =
      document.getElementById(`card-${el.id}`) ||
      document.getElementById(`pdf-page-${el.id}`) ||
      document.getElementById(`image-card-${el.id}`) ||
      document.getElementById(`arrow-${el.id}`);

    if (domEl) {
      const cloned = domEl.cloneNode(true) as HTMLElement;
      // Remove any interactive UI controls/handles from cloned node
      const controls = cloned.querySelectorAll('[data-control-bar], [title*="Drag"], [title*="adjust"]');
      controls.forEach((c) => c.remove());

      cloned.style.position = 'absolute';
      cloned.style.left = '0';
      cloned.style.top = '0';
      if (el.type === 'arrow') {
        const leftVal = parseFloat(domEl.style.left || '0');
        const topVal = parseFloat(domEl.style.top || '0');
        cloned.style.left = `${leftVal - bboxX}px`;
        cloned.style.top = `${topVal - bboxY}px`;
        cloned.style.transform = 'none';
      } else {
        cloned.style.transform = `translate(${el.x - bboxX}px, ${el.y - bboxY}px)`;
      }
      cloned.style.boxShadow = 'none'; // clean rendering for print
      offscreenContainer.appendChild(cloned);
    }
  }

  document.body.appendChild(offscreenContainer);

  try {
    // 3. html2canvas-pro (§10 P2) — any allowed for options per §10 P9 rule
    const opts: any = {
      scale: 2,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
    };
    const renderedCanvas = await html2canvas(offscreenContainer, opts);

    // 4. Slice canvas into A4-proportioned bands
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const pageAspectRatio = pageHeightMm / pageWidthMm;

    const slicePixelHeight = Math.floor(renderedCanvas.width * pageAspectRatio);
    const totalHeight = renderedCanvas.height;
    let currentSrcY = 0;
    let pageIndex = 0;

    while (currentSrcY < totalHeight) {
      const remainingHeight = totalHeight - currentSrcY;
      const currentSliceH = Math.min(slicePixelHeight, remainingHeight);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = renderedCanvas.width;
      sliceCanvas.height = slicePixelHeight;
      const sliceCtx = sliceCanvas.getContext('2d');

      if (sliceCtx) {
        sliceCtx.fillStyle = '#FFFFFF';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, slicePixelHeight);
        sliceCtx.drawImage(
          renderedCanvas,
          0,
          currentSrcY,
          renderedCanvas.width,
          currentSliceH,
          0,
          0,
          renderedCanvas.width,
          currentSliceH
        );
      }

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);

      if (pageIndex > 0) {
        doc.addPage();
      }
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);

      currentSrcY += slicePixelHeight;
      pageIndex++;
    }

    // 5. Save output via native dialog or browser fallback
    const defaultFilename = `${notebookName} — ${sectionName}.pdf`;

    // @ts-expect-error — Tauri check
    const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

    if (isTauri) {
      const savePath = await save({
        defaultPath: defaultFilename,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });

      if (savePath) {
        const buffer = doc.output('arraybuffer');
        await writeFile(savePath, new Uint8Array(buffer));
      }
    } else {
      doc.save(defaultFilename);
    }
  } finally {
    if (document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
  }
}
