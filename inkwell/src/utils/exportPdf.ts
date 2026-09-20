import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { ArrowElement, CanvasElement } from '../types';

interface ArrowGeometry {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  pathStartX: number;
  pathStartY: number;
  pathEndX: number;
  pathEndY: number;
  cpx: number;
  cpy: number;
  strokeWidth: number;
  arrowColor: string;
  arrowHeadPosition: 'start' | 'end' | 'both';
  startHead: {
    tipX: number;
    tipY: number;
    leftX: number;
    leftY: number;
    rightX: number;
    rightY: number;
  };
  endHead: {
    tipX: number;
    tipY: number;
    leftX: number;
    leftY: number;
    rightX: number;
    rightY: number;
  };
}

function computeArrowGeometry(el: ArrowElement, bboxX: number, bboxY: number): ArrowGeometry {
  const { startX, startY, endX, endY } = el;
  const strokeWidth = el.strokeWidth || 2.5;

  // On white PDF paper, default black or light colors should render as high-contrast dark
  let arrowColor = el.color || '#111827';
  const lower = arrowColor.toLowerCase();
  if (lower === '#ffffff' || lower === '#ececec' || lower === '#f3f4f6' || lower === 'white') {
    arrowColor = '#111827';
  }

  const arrowHeadPosition = el.arrowHeadPosition || 'start';

  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  const safeDist = Math.max(dist, 1);

  const nx = -dy / safeDist;
  const ny = dx / safeDist;

  const h = el.controlOffset !== undefined ? el.controlOffset : Math.min(60, Math.max(25, safeDist * 0.22));

  const mx = (startX + endX) / 2;
  const my = (startY + endY) / 2;

  const cx = mx + nx * h;
  const cy = my + ny * h;

  const headLen = 13;
  const headWidth = 5;

  const hasStartHead = arrowHeadPosition === 'start' || arrowHeadPosition === 'both';
  const hasEndHead = arrowHeadPosition === 'end' || arrowHeadPosition === 'both';

  // Tangent unit vectors for arrowheads pointing towards their respective tips
  const vStartX = startX - cx;
  const vStartY = startY - cy;
  const lenStart = Math.hypot(vStartX, vStartY) || 1;
  const uxStart = vStartX / lenStart;
  const uyStart = vStartY / lenStart;
  const vxStart = -uyStart;
  const vyStart = uxStart;

  const startTipX = startX - bboxX;
  const startTipY = startY - bboxY;
  const startBaseX = startTipX - uxStart * headLen;
  const startBaseY = startTipY - uyStart * headLen;
  const startLeftX = startBaseX + vxStart * headWidth;
  const startLeftY = startBaseY + vyStart * headWidth;
  const startRightX = startBaseX - vxStart * headWidth;
  const startRightY = startBaseY - vyStart * headWidth;

  const vEndX = endX - cx;
  const vEndY = endY - cy;
  const lenEnd = Math.hypot(vEndX, vEndY) || 1;
  const uxEnd = vEndX / lenEnd;
  const uyEnd = vEndY / lenEnd;
  const vxEnd = -uyEnd;
  const vyEnd = uxEnd;

  const endTipX = endX - bboxX;
  const endTipY = endY - bboxY;
  const endBaseX = endTipX - uxEnd * headLen;
  const endBaseY = endTipY - uyEnd * headLen;
  const endLeftX = endBaseX + vxEnd * headWidth;
  const endLeftY = endBaseY + vyEnd * headWidth;
  const endRightX = endBaseX - vxEnd * headWidth;
  const endRightY = endBaseY - vyEnd * headWidth;

  // Shaft path endpoints recessed inside arrowhead by (headLen - 2.5) so rounded linecap never pokes out of the tip
  const pathStartX = hasStartHead ? startTipX - uxStart * (headLen - 2.5) : startX - bboxX;
  const pathStartY = hasStartHead ? startTipY - uyStart * (headLen - 2.5) : startY - bboxY;
  const pathEndX = hasEndHead ? endTipX - uxEnd * (headLen - 2.5) : endX - bboxX;
  const pathEndY = hasEndHead ? endTipY - uyEnd * (headLen - 2.5) : endY - bboxY;

  return {
    sx: startX - bboxX,
    sy: startY - bboxY,
    ex: endX - bboxX,
    ey: endY - bboxY,
    pathStartX,
    pathStartY,
    pathEndX,
    pathEndY,
    cpx: cx - bboxX,
    cpy: cy - bboxY,
    strokeWidth,
    arrowColor,
    arrowHeadPosition,
    startHead: {
      tipX: startTipX,
      tipY: startTipY,
      leftX: startLeftX,
      leftY: startLeftY,
      rightX: startRightX,
      rightY: startRightY,
    },
    endHead: {
      tipX: endTipX,
      tipY: endTipY,
      leftX: endLeftX,
      leftY: endLeftY,
      rightX: endRightX,
      rightY: endRightY,
    },
  };
}

export async function exportSectionToPdf(
  elements: CanvasElement[],
  notebookName: string,
  sectionName: string
): Promise<void> {
  if (elements.length === 0) {
    alert('Canvas is empty. Add text or PDF pages before exporting.');
    return;
  }

  // 1. Calculate bounding box of all elements (+ 48px margin), including Bézier control points
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    if (el.type === 'arrow') {
      const dx = el.endX - el.startX;
      const dy = el.endY - el.startY;
      const dist = Math.hypot(dx, dy);
      const safeDist = Math.max(dist, 1);
      const nx = -dy / safeDist;
      const ny = dx / safeDist;
      const h = el.controlOffset !== undefined ? el.controlOffset : Math.min(60, Math.max(25, safeDist * 0.22));
      const cx = (el.startX + el.endX) / 2 + nx * h;
      const cy = (el.startY + el.endY) / 2 + ny * h;

      const minArrowX = Math.min(el.startX, el.endX, cx) - 30;
      const maxArrowX = Math.max(el.startX, el.endX, cx) + 30;
      const minArrowY = Math.min(el.startY, el.endY, cy) - 30;
      const maxArrowY = Math.max(el.startY, el.endY, cy) + 30;
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
  offscreenContainer.style.color = '#111827';
  offscreenContainer.style.overflow = 'hidden';
  offscreenContainer.style.zIndex = '-9999';

  // 2a. Add non-arrow cards (Text notes, PDF pages, Image attachments)
  for (const el of elements) {
    if (el.type === 'arrow') continue;

    const domEl =
      document.getElementById(`card-${el.id}`) ||
      document.getElementById(`pdf-page-${el.id}`) ||
      document.getElementById(`image-card-${el.id}`);

    if (domEl) {
      const cloned = domEl.cloneNode(true) as HTMLElement;
      // Remove interactive UI controls & resize handles
      const controls = cloned.querySelectorAll(
        '[data-control-bar], [data-resize-handle], [title*="Drag"], [title*="adjust"]'
      );
      controls.forEach((c) => c.remove());

      // Ensure text is dark and high-contrast on white PDF paper
      const textNodes = cloned.querySelectorAll<HTMLElement>('.ProseMirror, .ProseMirror *');
      textNodes.forEach((node) => {
        node.style.color = '#111827';
      });

      cloned.style.position = 'absolute';
      cloned.style.left = '0';
      cloned.style.top = '0';
      cloned.style.transform = `translate(${el.x - bboxX}px, ${el.y - bboxY}px)`;
      cloned.style.boxShadow = 'none';
      offscreenContainer.appendChild(cloned);
    }
  }

  // 2b. Add Arrow vector layer to offscreen container
  const arrows = elements.filter((el): el is ArrowElement => el.type === 'arrow');
  if (arrows.length > 0) {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('width', `${Math.ceil(bboxWidth)}`);
    svgEl.setAttribute('height', `${Math.ceil(bboxHeight)}`);
    svgEl.setAttribute('viewBox', `0 0 ${Math.ceil(bboxWidth)} ${Math.ceil(bboxHeight)}`);
    svgEl.style.position = 'absolute';
    svgEl.style.left = '0px';
    svgEl.style.top = '0px';
    svgEl.style.width = `${Math.ceil(bboxWidth)}px`;
    svgEl.style.height = `${Math.ceil(bboxHeight)}px`;
    svgEl.style.zIndex = '500';

    for (const arrow of arrows) {
      const geo = computeArrowGeometry(arrow, bboxX, bboxY);

      // Curved shaft
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', `M ${geo.pathStartX} ${geo.pathStartY} Q ${geo.cpx} ${geo.cpy} ${geo.pathEndX} ${geo.pathEndY}`);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', geo.arrowColor);
      pathEl.setAttribute('stroke-width', `${geo.strokeWidth}`);
      pathEl.setAttribute('stroke-linecap', 'round');
      svgEl.appendChild(pathEl);

      // Arrowhead at Start
      if (geo.arrowHeadPosition === 'start' || geo.arrowHeadPosition === 'both') {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute(
          'points',
          `${geo.startHead.tipX},${geo.startHead.tipY} ${geo.startHead.leftX},${geo.startHead.leftY} ${geo.startHead.rightX},${geo.startHead.rightY}`
        );
        poly.setAttribute('fill', geo.arrowColor);
        svgEl.appendChild(poly);
      }

      // Arrowhead at End
      if (geo.arrowHeadPosition === 'end' || geo.arrowHeadPosition === 'both') {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute(
          'points',
          `${geo.endHead.tipX},${geo.endHead.tipY} ${geo.endHead.leftX},${geo.endHead.leftY} ${geo.endHead.rightX},${geo.endHead.rightY}`
        );
        poly.setAttribute('fill', geo.arrowColor);
        svgEl.appendChild(poly);
      }
    }

    offscreenContainer.appendChild(svgEl);
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

    // 3b. Guaranteed Canvas 2D direct draw of arrows on renderedCanvas
    // This provides 100% reliability regardless of browser SVG image decode timing
    const ctx = renderedCanvas.getContext('2d');
    if (ctx && arrows.length > 0) {
      const scale = opts.scale || 2;
      ctx.save();
      ctx.scale(scale, scale);

      for (const arrow of arrows) {
        const geo = computeArrowGeometry(arrow, bboxX, bboxY);

        // Curved shaft
        ctx.beginPath();
        ctx.moveTo(geo.pathStartX, geo.pathStartY);
        ctx.quadraticCurveTo(geo.cpx, geo.cpy, geo.pathEndX, geo.pathEndY);
        ctx.strokeStyle = geo.arrowColor;
        ctx.lineWidth = geo.strokeWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Arrowhead at Start
        if (geo.arrowHeadPosition === 'start' || geo.arrowHeadPosition === 'both') {
          ctx.beginPath();
          ctx.moveTo(geo.startHead.tipX, geo.startHead.tipY);
          ctx.lineTo(geo.startHead.leftX, geo.startHead.leftY);
          ctx.lineTo(geo.startHead.rightX, geo.startHead.rightY);
          ctx.closePath();
          ctx.fillStyle = geo.arrowColor;
          ctx.fill();
        }

        // Arrowhead at End
        if (geo.arrowHeadPosition === 'end' || geo.arrowHeadPosition === 'both') {
          ctx.beginPath();
          ctx.moveTo(geo.endHead.tipX, geo.endHead.tipY);
          ctx.lineTo(geo.endHead.leftX, geo.endHead.leftY);
          ctx.lineTo(geo.endHead.rightX, geo.endHead.rightY);
          ctx.closePath();
          ctx.fillStyle = geo.arrowColor;
          ctx.fill();
        }
      }

      ctx.restore();
    }

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
