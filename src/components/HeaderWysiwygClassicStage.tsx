import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';

import type {
  HeaderManualRectPct,
  HeaderWysiwygClassicAlign,
  HeaderWysiwygClassicPct,
  HeaderWysiwygTextAlign,
} from '../utils/headerWysiwyg';
import {
  alignRectToParentX,
  pctToPxRect,
  rectsToPct,
  snapHeaderManualRectPct,
} from '../utils/headerWysiwyg';

export type HeaderWysiwygZoneId = keyof HeaderWysiwygClassicPct;

type Props = {
  pct: HeaderWysiwygClassicPct;
  align: HeaderWysiwygClassicAlign;
  layoutEditMode: boolean;
  barMinHeightPx: number;
  /** `calendarLayoutScalePercent` / 100 — נדרש ל־react-rnd כש־CSS zoom על המיכל */
  dragScale: number;
  onPctChange: (next: HeaderWysiwygClassicPct) => void;
  onAlignChange: (next: HeaderWysiwygClassicAlign) => void;
  titlesContent: ReactNode;
  hebrewContent: ReactNode;
  gregorianContent: ReactNode;
};

const rndHandle = 'absolute z-30 h-1.5 w-1.5 rounded-none border border-sky-500/70 bg-white';

export function HeaderWysiwygClassicStage({
  pct,
  align,
  layoutEditMode,
  barMinHeightPx,
  dragScale,
  onPctChange,
  onAlignChange,
  titlesContent,
  hebrewContent,
  gregorianContent,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState<HeaderWysiwygZoneId | null>(null);
  const [selected, setSelected] = useState<HeaderWysiwygZoneId | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setBox({
        w: Math.max(1, el.clientWidth),
        h: Math.max(barMinHeightPx, el.clientHeight),
      });
    });
    ro.observe(el);
    setBox({
      w: Math.max(1, el.clientWidth),
      h: Math.max(barMinHeightPx, el.clientHeight),
    });
    return () => ro.disconnect();
  }, [barMinHeightPx]);

  const commitZone = (id: HeaderWysiwygZoneId, node: HTMLElement) => {
    const st = stageRef.current;
    if (!st) return;
    const pr = st.getBoundingClientRect();
    const cr = node.getBoundingClientRect();
    let next = rectsToPct(pr, cr);
    next = snapHeaderManualRectPct(next);
    onPctChange({ ...pct, [id]: next });
  };

  const zoneBox = (z: HeaderManualRectPct) => {
    const pw = box?.w ?? 400;
    const ph = box?.h ?? Math.max(barMinHeightPx, 1);
    return pctToPxRect(z, pw, ph);
  };

  const setAlignForZone = (id: HeaderWysiwygZoneId, a: HeaderWysiwygTextAlign) => {
    if (id === 'hebrew') return;
    const nextAlign: HeaderWysiwygClassicAlign =
      id === 'titles'
        ? { ...align, titles: a }
        : { ...align, gregorian: a };
    onAlignChange(nextAlign);
    // Also snap the zone box to the chosen alignment (visual expectation).
    onPctChange({ ...pct, [id]: alignRectToParentX(pct[id], a) });
  };

  const activeZone = selected ?? dragging;
  const toolbar =
    layoutEditMode && activeZone && activeZone !== 'hebrew' ? (
      <div className="absolute right-2 top-2 z-50 flex items-center gap-1 rounded-md border border-amber-200 bg-white/95 px-1.5 py-1 text-xs shadow-sm">
        <span className="px-1 text-slate-500">יישור:</span>
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setAlignForZone(activeZone, 'right')}
        >
          ימין
        </button>
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setAlignForZone(activeZone, 'center')}
        >
          אמצע
        </button>
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setAlignForZone(activeZone, 'left')}
        >
          שמאל
        </button>
      </div>
    ) : null;

  const titlesAlign =
    align.titles === 'center'
      ? 'items-center text-center'
      : align.titles === 'left'
        ? 'items-start text-left'
        : 'items-end text-right';

  const gregAlign =
    align.gregorian === 'center'
      ? 'justify-center'
      : align.gregorian === 'right'
        ? 'justify-end'
        : 'justify-start';

  const renderStatic = (id: HeaderWysiwygZoneId, child: ReactNode, extraClass?: string) => {
    const z = pct[id];
    return (
      <div
        key={id}
        className={extraClass}
        style={{
          position: 'absolute',
          left: `${z.xPct}%`,
          top: `${z.yPct}%`,
          width: `${z.wPct}%`,
          height: `${z.hPct}%`,
          boxSizing: 'border-box',
          minWidth: 0,
          overflow: 'visible',
        }}
      >
        {child}
      </div>
    );
  };

  const renderEdit = (id: HeaderWysiwygZoneId, child: ReactNode) => {
    const z = pct[id];
    const { x, y, width, height } = zoneBox(z);
    return (
      <Rnd
        key={`${id}-${z.xPct.toFixed(2)}-${z.yPct.toFixed(2)}-${z.wPct.toFixed(2)}-${z.hPct.toFixed(2)}`}
        bounds="parent"
        default={{ x, y, width, height }}
        minWidth={48}
        minHeight={28}
        scale={dragScale > 0 ? dragScale : 1}
        enableResizing
        className={layoutEditMode ? 'cursor-move' : undefined}
        resizeHandleClasses={{
          bottom: rndHandle,
          bottomLeft: rndHandle,
          bottomRight: rndHandle,
          left: rndHandle,
          right: rndHandle,
          top: rndHandle,
          topLeft: rndHandle,
          topRight: rndHandle,
        }}
        style={{ zIndex: id === 'hebrew' ? 12 : id === 'titles' ? 11 : 10 }}
        onMouseDown={() => setSelected(id)}
        onDragStart={() => setDragging(id)}
        onDragStop={(_e, d) => {
          setDragging(null);
          setSelected(id);
          commitZone(id, d.node as HTMLElement);
        }}
        onResizeStart={() => setDragging(id)}
        onResizeStop={(_e, _dir, nodeRef) => {
          setDragging(null);
          setSelected(id);
          commitZone(id, nodeRef);
        }}
      >
        <div
          className={[
            'h-full min-h-0 w-full min-w-0 overflow-visible',
            layoutEditMode
              ? selected === id
                ? 'outline outline-[1px] outline-sky-500'
                : 'outline outline-[1px] outline-sky-300/50'
              : '',
          ].join(' ')}
        >
          {child}
        </div>
      </Rnd>
    );
  };

  return (
    <div
      ref={stageRef}
      className={[
        'relative w-full min-w-0 overflow-visible',
        layoutEditMode ? 'ring-1 ring-dashed ring-sky-400/40' : '',
        layoutEditMode ? 'cursor-default' : '',
      ].join(' ')}
      style={{ minHeight: barMinHeightPx }}
      onMouseDown={(e) => {
        if (!layoutEditMode) return;
        const t = e.target as HTMLElement | null;
        // Click on toolbar keeps selection.
        if (t && t.closest('[data-wysiwyg-toolbar]')) return;
        // Click outside stage's RND wrappers clears selection.
        if (t && t.closest('.react-rnd')) return;
        setSelected(null);
      }}
    >
      {toolbar ? <div data-wysiwyg-toolbar="1">{toolbar}</div> : null}
      {layoutEditMode && dragging ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-px -translate-x-1/2 bg-sky-400/30"
            style={{ height: '100%' }}
          />
          <div
            className="pointer-events-none absolute left-0 top-1/2 z-0 h-px w-full -translate-y-1/2 bg-sky-400/30"
          />
        </>
      ) : null}

      {layoutEditMode && box
        ? renderEdit(
            'titles',
            <div className={['flex h-full min-h-0 w-full flex-col justify-start gap-0.5 overflow-visible pr-0.5', titlesAlign].join(' ')}>
              {titlesContent}
            </div>,
          )
        : renderStatic(
            'titles',
            <div className={['flex h-full min-h-0 w-full flex-col justify-start gap-0.5 overflow-visible pr-0.5', titlesAlign].join(' ')}>
              {titlesContent}
            </div>,
          )}

      {layoutEditMode && box
        ? renderEdit('hebrew', <div className="flex h-full w-full items-center justify-center">{hebrewContent}</div>)
        : renderStatic(
            'hebrew',
            <div className="flex h-full w-full items-center justify-center">{hebrewContent}</div>,
          )}

      {layoutEditMode && box
        ? renderEdit(
            'gregorian',
            <div className={['flex h-full w-full items-center overflow-visible', gregAlign].join(' ')}>
              {gregorianContent}
            </div>,
          )
        : renderStatic(
            'gregorian',
            <div className={['flex h-full w-full items-center overflow-visible', gregAlign].join(' ')}>
              {gregorianContent}
            </div>,
          )}
    </div>
  );
}
