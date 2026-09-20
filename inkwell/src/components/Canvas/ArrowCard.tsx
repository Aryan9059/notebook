import { type FC, memo, useRef, useCallback } from 'react';
import { ArrowLeftRight, Trash2, RotateCw } from 'lucide-react';
import { ArrowElement } from '../../types';
import { useNotesStore } from '../../store/useNotesStore';
import { useUiStore } from '../../store/useUiStore';

interface ArrowCardProps {
  element: ArrowElement;
}

const ArrowCardInner: FC<ArrowCardProps> = ({ element }) => {
  const selectedId = useUiStore((state) => state.selectedId);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const setSelectedId = useUiStore((state) => state.setSelectedId);
  const activeTool = useUiStore((state) => state.activeTool);

  const updateElement = useNotesStore((state) => state.updateElement);
  const deleteElement = useNotesStore((state) => state.deleteElement);

  const isSelected = selectedId === element.id || selectedIds.includes(element.id);

  // Drag interaction refs for handles
  const isDraggingHandleRef = useRef<'start' | 'end' | 'control' | 'body' | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    controlOffset: number;
  } | null>(null);

  const { startX, startY, endX, endY } = element;
  const strokeWidth = element.strokeWidth || 2.5;
  const color = element.color || '#000000';
  const arrowHeadPosition = element.arrowHeadPosition || 'start'; // Default: head at the first clicked point

  // Geometry calculations
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const safeDist = Math.max(dist, 1);

  // Normal vector perpendicular to the chord line
  const nx = -dy / safeDist;
  const ny = dx / safeDist;

  // Arc curvature height (signed: positive or negative for upward/downward arch)
  const h = element.controlOffset !== undefined ? element.controlOffset : Math.min(60, Math.max(25, safeDist * 0.22));

  // Midpoint
  const mx = (startX + endX) / 2;
  const my = (startY + endY) / 2;

  // Quadratic Bézier control point
  const cx = mx + nx * h;
  const cy = my + ny * h;

  // Tangent angles for arrowheads
  const thetaStart = Math.atan2(cy - startY, cx - startX);
  const thetaEnd = Math.atan2(endY - cy, endX - cx);

  // Arrowhead polygon at start (pointing at start point: direction thetaStart + PI)
  const headLen = 15;
  const headWidth = 8;

  const startTipX = startX;
  const startTipY = startY;
  const startAngle = thetaStart + Math.PI;
  const startLeftX = startTipX - headLen * Math.cos(startAngle) + headWidth * Math.sin(startAngle);
  const startLeftY = startTipY - headLen * Math.sin(startAngle) - headWidth * Math.cos(startAngle);
  const startRightX = startTipX - headLen * Math.cos(startAngle) - headWidth * Math.sin(startAngle);
  const startRightY = startTipY - headLen * Math.sin(startAngle) + headWidth * Math.cos(startAngle);

  // Arrowhead polygon at end (pointing at end point: direction thetaEnd)
  const endTipX = endX;
  const endTipY = endY;
  const endAngle = thetaEnd;
  const endLeftX = endTipX - headLen * Math.cos(endAngle) + headWidth * Math.sin(endAngle);
  const endLeftY = endTipY - headLen * Math.sin(endAngle) - headWidth * Math.cos(endAngle);
  const endRightX = endTipX - headLen * Math.cos(endAngle) - headWidth * Math.sin(endAngle);
  const endRightY = endTipY - headLen * Math.sin(endAngle) + headWidth * Math.cos(endAngle);

  // Handle pointer down for endpoints or curvature
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handleType: 'start' | 'end' | 'control' | 'body') => {
      if (activeTool === 'hand' || activeTool === 'arrow') return;
      e.stopPropagation();
      setSelectedId(element.id);

      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingHandleRef.current = handleType;
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startX: element.startX,
        startY: element.startY,
        endX: element.endX,
        endY: element.endY,
        controlOffset: h,
      };
    },
    [activeTool, element.id, element.startX, element.startY, element.endX, element.endY, h, setSelectedId]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingHandleRef.current || !dragStartRef.current) return;
      e.stopPropagation();

      const state = useNotesStore.getState();
      const currentNb = state.notebooks.find((nb) => nb.id === state.activeNotebookId);
      const currentSec = currentNb?.sections.find((s) => s.id === state.activeSectionId);
      const zoom = currentSec?.viewport.zoom ?? 1;

      const dCanvasX = (e.clientX - dragStartRef.current.clientX) / zoom;
      const dCanvasY = (e.clientY - dragStartRef.current.clientY) / zoom;

      const handle = isDraggingHandleRef.current;

      if (handle === 'start') {
        const nextStartX = dragStartRef.current.startX + dCanvasX;
        const nextStartY = dragStartRef.current.startY + dCanvasY;
        updateElement(element.id, { startX: nextStartX, startY: nextStartY }, false);
      } else if (handle === 'end') {
        const nextEndX = dragStartRef.current.endX + dCanvasX;
        const nextEndY = dragStartRef.current.endY + dCanvasY;
        updateElement(element.id, { endX: nextEndX, endY: nextEndY }, false);
      } else if (handle === 'control') {
        // Project cursor displacement onto normal vector to adjust arch
        const deltaOffset = dCanvasX * nx + dCanvasY * ny;
        const nextOffset = dragStartRef.current.controlOffset + deltaOffset;
        updateElement(element.id, { controlOffset: nextOffset }, false);
      } else if (handle === 'body') {
        updateElement(
          element.id,
          {
            startX: dragStartRef.current.startX + dCanvasX,
            startY: dragStartRef.current.startY + dCanvasY,
            endX: dragStartRef.current.endX + dCanvasX,
            endY: dragStartRef.current.endY + dCanvasY,
          },
          false
        );
      }
    },
    [element.id, nx, ny, updateElement]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDraggingHandleRef.current) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
        isDraggingHandleRef.current = null;
        dragStartRef.current = null;
        useNotesStore.getState().commitUndoSnapshot();
      }
    },
    []
  );

  // Toggle arrow head position (start vs end vs both)
  const toggleArrowHead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPos: 'start' | 'end' | 'both' =
      arrowHeadPosition === 'start' ? 'end' : arrowHeadPosition === 'end' ? 'both' : 'start';
    updateElement(element.id, { arrowHeadPosition: nextPos }, true);
  };

  // Flip curve direction (bend other side: upward vs downward)
  const flipCurve = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateElement(element.id, { controlOffset: -h }, true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElement(element.id);
    if (selectedId === element.id) setSelectedId(null);
  };

  return (
    <div
      id={`arrow-${element.id}`}
      className="absolute top-0 left-0 overflow-visible pointer-events-none select-none"
      style={{
        zIndex: element.zIndex || 500,
      }}
    >
      <svg
        className="overflow-visible pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible',
        }}
      >
        {/* Invisible wider stroke (32px) for easy click selection & dragging */}
        <path
          d={`M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`}
          fill="none"
          stroke="transparent"
          strokeWidth={32}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: activeTool === 'hand' ? 'default' : 'pointer' }}
          onClick={(e) => {
            if (activeTool !== 'hand' && activeTool !== 'arrow') {
              e.stopPropagation();
              setSelectedId(element.id);
            }
          }}
          onPointerDown={(e) => handlePointerDown(e, 'body')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Visible smooth curved arrow shaft */}
        <path
          d={`M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: activeTool === 'hand' ? 'default' : 'pointer' }}
          onClick={(e) => {
            if (activeTool !== 'hand' && activeTool !== 'arrow') {
              e.stopPropagation();
              setSelectedId(element.id);
            }
          }}
          onPointerDown={(e) => handlePointerDown(e, 'body')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Arrowhead at Start (Default for labeling) */}
        {(arrowHeadPosition === 'start' || arrowHeadPosition === 'both') && (
          <polygon
            points={`${startTipX},${startTipY} ${startLeftX},${startLeftY} ${startRightX},${startRightY}`}
            fill={color}
            style={{ pointerEvents: 'all', cursor: activeTool === 'hand' ? 'default' : 'pointer' }}
            onClick={(e) => {
              if (activeTool !== 'hand' && activeTool !== 'arrow') {
                e.stopPropagation();
                setSelectedId(element.id);
              }
            }}
            onPointerDown={(e) => handlePointerDown(e, 'body')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        )}

        {/* Arrowhead at End */}
        {(arrowHeadPosition === 'end' || arrowHeadPosition === 'both') && (
          <polygon
            points={`${endTipX},${endTipY} ${endLeftX},${endLeftY} ${endRightX},${endRightY}`}
            fill={color}
            style={{ pointerEvents: 'all', cursor: activeTool === 'hand' ? 'default' : 'pointer' }}
            onClick={(e) => {
              if (activeTool !== 'hand' && activeTool !== 'arrow') {
                e.stopPropagation();
                setSelectedId(element.id);
              }
            }}
            onPointerDown={(e) => handlePointerDown(e, 'body')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        )}
      </svg>

      {/* Interactive Selection Handles & Controls (visible when selected) */}
      {isSelected && (
        <div style={{ pointerEvents: 'auto' }}>
          {/* Start Point Handle (Resizes / repositions arrow start) */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'start')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title="Drag to resize arrow start position"
            style={{
              position: 'absolute',
              left: `${startX - 7}px`,
              top: `${startY - 7}px`,
              width: '14px',
              height: '14px',
            }}
            className="rounded-full bg-white border-2 border-black shadow-lg cursor-crosshair hover:scale-125 transition-transform z-50"
          />

          {/* End Point Handle (Resizes / repositions arrow end & length) */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'end')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title="Drag to resize arrow end & length"
            style={{
              position: 'absolute',
              left: `${endX - 7}px`,
              top: `${endY - 7}px`,
              width: '14px',
              height: '14px',
            }}
            className="rounded-full bg-white border-2 border-black shadow-lg cursor-crosshair hover:scale-125 transition-transform z-50"
          />

          {/* Curvature Control Point Handle (Adjusts curve arch) */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'control')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title="Drag to adjust curve arch"
            style={{
              position: 'absolute',
              left: `${cx - 6}px`,
              top: `${cy - 6}px`,
              width: '12px',
              height: '12px',
            }}
            className="rounded-full bg-black hover:bg-gray-800 border-2 border-white shadow-md cursor-move hover:scale-125 transition-transform z-50"
          />

          {/* Floating Action Bar centered above the midpoint */}
          <div
            data-control-bar="true"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: `${cx}px`,
              top: `${cy - 36}px`,
              transform: 'translateX(-50%)',
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/95 backdrop-blur-xl border border-black/10 shadow-[0_4px_16px_rgba(0,0,0,0.12)] z-50 animate-fade-in no-drag whitespace-nowrap"
          >
            <button
              type="button"
              onClick={toggleArrowHead}
              title={`Arrowhead: ${arrowHeadPosition}. Click to toggle.`}
              className="px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-black hover:bg-black/[0.05] transition cursor-pointer"
            >
              <ArrowLeftRight size={13} />
              <span className="capitalize">{arrowHeadPosition}</span>
            </button>

            <button
              type="button"
              onClick={flipCurve}
              title="Flip curve (upward / downward)"
              className="px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-black hover:bg-black/[0.05] transition cursor-pointer"
            >
              <RotateCw size={13} />
              <span>Flip Arch</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              title="Delete arrow"
              className="px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ArrowCard = memo(ArrowCardInner, (prev, next) => {
  const pe = prev.element;
  const ne = next.element;
  return (
    pe.id === ne.id &&
    pe.startX === ne.startX &&
    pe.startY === ne.startY &&
    pe.endX === ne.endX &&
    pe.endY === ne.endY &&
    pe.controlOffset === ne.controlOffset &&
    pe.color === ne.color &&
    pe.strokeWidth === ne.strokeWidth &&
    pe.arrowHeadPosition === ne.arrowHeadPosition &&
    pe.zIndex === ne.zIndex
  );
});
