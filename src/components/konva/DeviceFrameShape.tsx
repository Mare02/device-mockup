/**
 * DeviceFrameShape
 * ─────────────────
 * Renders a complete device mockup at an arbitrary width × height.
 *
 *  ┌── cell (gradient background) ────────┐
 *  │  ┌── phone body (black shell) ────┐  │
 *  │  │  ┌── screen (clipped) ──────┐  │  │
 *  │  │  │   screenshot image       │  │  │
 *  │  │  │   notch overlay          │  │  │
 *  │  │  └──────────────────────────┘  │  │
 *  │  └────────────────────────────────┘  │
 *  └──────────────────────────────────────┘
 *
 * Everything scales uniformly:
 *   s = width / (model.width + basePadding * 2)
 *
 * The phone frame is a separate draggable Group offset by frameX/frameY.
 */
import { useEffect, useState, useMemo } from "react";
import { Group, Rect, Circle, Image as KonvaImage, Line, Shape } from "react-konva";
import type { DeviceModel, ImgProps } from "./types";
import type Konva from "konva";
import { resolveGradientColors, loadImage, getModel } from "./helpers";

type Props = {
  /** Total cell width (the element's width in canvas space) */
  width: number;
  /** Total cell height */
  height: number;
  /** Device model ID */
  modelId: string;
  /** Base padding in design-space pixels (scales with the cell) */
  basePadding: number;
  /** Screenshot data-URL */
  screenshot: string | null;
  /** Gradient class or hex colour */
  gradient: string;
  /** Image transform props */
  imgProps: ImgProps;
  /** Shadow intensity (0-100) */
  shadowIntensity: number;
  /** Offset of the frame within the wrapper */
  frameX: number;
  frameY: number;
  /** Whether this element is selected */
  isSelected: boolean;
  /** Whether the frame is draggable (select mode + not locked) */
  isDraggable: boolean;
  /** Element ID (used for Transformer targeting) */
  elementId: string;
  /** Callback when frame drag ends */
  onFrameDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  /** Callback when frame transform (resize/rotate) ends */
  onFrameTransformEnd?: (e: Konva.KonvaEventObject<Event>) => void;
};

export function DeviceFrameShape({
  width,
  height,
  modelId,
  basePadding,
  screenshot,
  gradient,
  imgProps,
  shadowIntensity,
  frameX,
  frameY,
  isSelected,
  isDraggable,
  elementId,
  onFrameDragEnd,
  onFrameTransformEnd,
}: Props) {
  const model = getModel(modelId);
  const [screenshotImg, setScreenshotImg] = useState<HTMLImageElement | null>(
    null
  );

  // Load screenshot image when it changes
  useEffect(() => {
    if (!screenshot) {
      setScreenshotImg(null);
      return;
    }
    let cancelled = false;
    loadImage(screenshot).then((img) => {
      if (!cancelled) setScreenshotImg(img);
    });
    return () => {
      cancelled = true;
    };
  }, [screenshot]);

  // ── Uniform scale factor ──
  const baseCellW = model.width + basePadding * 2;
  const s = width / baseCellW;

  const pad = basePadding * s;
  const phoneW = model.width * s;
  const phoneH = model.height * s;
  const radius = model.radius * s;
  const bezel = model.bezel * s;
  const screenRadius = Math.max(radius - bezel, 4 * s);
  const safeShadow = Math.min(shadowIntensity, 40);

  // Phone centred in cell (default position before frameX/Y offset)
  const phoneX = pad;
  const phoneY = (height - phoneH) / 2;

  // Screen area
  const screenX = phoneX + bezel;
  const screenY = phoneY + bezel;
  const screenW = phoneW - bezel * 2;
  const screenH = phoneH - bezel * 2;

  // Gradient colours
  const colors = resolveGradientColors(gradient);
  const isSolid = colors[0] === colors[2];

  // Image transform
  const imgTransform = useMemo(() => {
    if (!screenshotImg) return null;
    const { scale, x, y, rotate } = imgProps;
    const coverScale = Math.max(
      screenW / screenshotImg.width,
      screenH / screenshotImg.height
    );
    const drawW = screenshotImg.width * coverScale;
    const drawH = screenshotImg.height * coverScale;
    return { scale: scale / 100, x: x * s, y: y * s, rotate, drawW, drawH };
  }, [screenshotImg, imgProps, screenW, screenH, s]);

  // Hardware button dimensions
  const btnW = Math.max(1.5, 3 * s);
  const powerH = 48 * s;
  const volH = 64 * s;

  // Move indicator dimensions
  const moveIconSize = Math.max(12, 18 * s);
  const moveIconX = phoneX + phoneW / 2;
  const moveIconY = phoneY - moveIconSize - 4 * s;
  const arrowLen = moveIconSize * 0.35;

  return (
    <>
      {/* ── Hit area (transparent, defines bounds for Transformer) ── */}
      <Rect x={0} y={0} width={width} height={height} fill="transparent" />

      {/* ── Background wrapper (NON-draggable, stays in place) ── */}
      {isSolid ? (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={colors[0]}
          cornerRadius={8 * s}
          listening={false}
        />
      ) : (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: width, y: height }}
          fillLinearGradientColorStops={[
            0,
            colors[0],
            0.5,
            colors[1],
            1,
            colors[2],
          ]}
          cornerRadius={8 * s}
          listening={false}
        />
      )}



      {/* ── Device frame group (offset by frameX/Y, draggable) ── */}
      <Group
        id={`frame-${elementId}`}
        x={frameX}
        y={frameY}
        draggable={isDraggable}
        onDragEnd={onFrameDragEnd}
        onTransformEnd={onFrameTransformEnd}
        onMouseEnter={(e) => {
          if (isDraggable) {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "move";
          }
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = "default";
        }}
      >
        {/* Transparent hit rect for the phone body (enables drag) */}
        <Rect
          x={phoneX}
          y={phoneY}
          width={phoneW}
          height={phoneH}
          fill="transparent"
          cornerRadius={radius}
        />

        {/* ── Phone outer body (with hole for screen) ── */}
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            // Outer body
            ctx.roundRect(phoneX, phoneY, phoneW, phoneH, radius);
            // Inner screen (hole)
            ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          fill="#000"
          fillRule="evenodd"
          shadowColor="rgba(0,0,0,0.8)"
          shadowBlur={safeShadow > 0 ? safeShadow * s * 2 : 0}
          shadowOffsetY={safeShadow * s * 0.5}
          shadowOpacity={Math.min(safeShadow / 100, 0.7)}
          listening={false}
        />

        {/* ── Ring highlight ── */}
        <Rect
          x={phoneX}
          y={phoneY}
          width={phoneW}
          height={phoneH}
          cornerRadius={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={Math.max(0.5, s)}
          listening={false}
        />

        {/* ── Hardware buttons ── */}
        <Rect
          x={phoneX + phoneW - 1}
          y={phoneY + phoneH * 0.25}
          width={btnW}
          height={powerH}
          fill="#3f3f46"
          listening={false}
        />
        <Rect
          x={phoneX - btnW + 1}
          y={phoneY + phoneH * 0.25}
          width={btnW}
          height={volH}
          fill="#3f3f46"
          listening={false}
        />
        <Rect
          x={phoneX - btnW + 1}
          y={phoneY + phoneH * 0.35}
          width={btnW}
          height={volH}
          fill="#3f3f46"
          listening={false}
        />

        {/* ── Screen area (clipped group) ── */}
        <Group
          clipFunc={(ctx: any) => {
            ctx.beginPath();
            ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
            ctx.closePath();
          }}
        >

          {/* Screenshot image */}
          {screenshotImg && imgTransform && (
            <KonvaImage
              image={screenshotImg}
              x={screenX + screenW / 2 + imgTransform.x}
              y={screenY + screenH / 2 + imgTransform.y}
              width={imgTransform.drawW}
              height={imgTransform.drawH}
              offsetX={imgTransform.drawW / 2}
              offsetY={imgTransform.drawH / 2}
              scaleX={imgTransform.scale}
              scaleY={imgTransform.scale}
              rotation={imgTransform.rotate}
              listening={false}
            />
          )}

          {/* ── Notch overlays ── */}
          {model.notchType === "dynamic-island" && (
            <Rect
              x={screenX + (screenW - 120 * s) / 2}
              y={screenY + 8 * s}
              width={120 * s}
              height={34 * s}
              fill="#000"
              cornerRadius={17 * s}
              listening={false}
            />
          )}
          {model.notchType === "notch" && (
            <Rect
              x={screenX + (screenW - 160 * s) / 2}
              y={screenY}
              width={160 * s}
              height={30 * s}
              fill="#000"
              cornerRadius={[0, 0, 12 * s, 12 * s]}
              listening={false}
            />
          )}
          {model.notchType === "punch-hole" && (
            <Circle
              x={screenX + screenW / 2}
              y={screenY + 20 * s}
              radius={10 * s}
              fill="#000"
              listening={false}
            />
          )}
          {model.notchType === "home-button" && (
            <>
              <Rect
                x={screenX}
                y={screenY}
                width={screenW}
                height={60 * s}
                fill="#000"
                listening={false}
              />
              <Rect
                x={screenX + (screenW - 40 * s) / 2}
                y={screenY + (60 * s - 6 * s) / 2}
                width={40 * s}
                height={6 * s}
                fill="#18181b"
                cornerRadius={3 * s}
                listening={false}
              />
              <Rect
                x={screenX}
                y={screenY + screenH - 60 * s}
                width={screenW}
                height={60 * s}
                fill="#000"
                listening={false}
              />
              <Circle
                x={screenX + screenW / 2}
                y={screenY + screenH - 30 * s}
                radius={24 * s}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={Math.max(0.5, s)}
                listening={false}
              />
            </>
          )}

          {/* Empty-screen placeholder indicator */}
          {!screenshot && (
            <>
              <Rect
                x={screenX + screenW / 2 - 20 * s}
                y={screenY + screenH / 2 - 20 * s}
                width={40 * s}
                height={40 * s}
                fill="transparent"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={Math.max(1, 1.5 * s)}
                cornerRadius={8 * s}
                dash={[6 * s, 3 * s]}
                listening={false}
              />
            </>
          )}
        </Group>

        {/* ── Move indicator (visible when selected + draggable) ── */}
        {isSelected && isDraggable && (
          <Group x={moveIconX} y={moveIconY} listening={false}>
            {/* Background pill */}
            <Rect
              x={-moveIconSize * 0.7}
              y={-moveIconSize * 0.4}
              width={moveIconSize * 1.4}
              height={moveIconSize * 0.8}
              fill="rgba(99,102,241,0.85)"
              cornerRadius={moveIconSize * 0.2}
              listening={false}
            />
            {/* Horizontal arrow */}
            <Line
              points={[-arrowLen, 0, arrowLen, 0]}
              stroke="#fff"
              strokeWidth={Math.max(1, 1.5 * s)}
              listening={false}
            />
            {/* Left arrowhead */}
            <Line
              points={[-arrowLen + arrowLen * 0.35, -arrowLen * 0.35, -arrowLen, 0, -arrowLen + arrowLen * 0.35, arrowLen * 0.35]}
              stroke="#fff"
              strokeWidth={Math.max(1, 1.5 * s)}
              listening={false}
            />
            {/* Right arrowhead */}
            <Line
              points={[arrowLen - arrowLen * 0.35, -arrowLen * 0.35, arrowLen, 0, arrowLen - arrowLen * 0.35, arrowLen * 0.35]}
              stroke="#fff"
              strokeWidth={Math.max(1, 1.5 * s)}
              listening={false}
            />
            {/* Vertical arrow */}
            <Line
              points={[0, -arrowLen, 0, arrowLen]}
              stroke="#fff"
              strokeWidth={Math.max(1, 1.5 * s)}
              listening={false}
            />
            {/* Top arrowhead */}
            <Line
              points={[-arrowLen * 0.35, -arrowLen + arrowLen * 0.35, 0, -arrowLen, arrowLen * 0.35, -arrowLen + arrowLen * 0.35]}
              stroke="#fff"
              strokeWidth={Math.max(1, 1.5 * s)}
              listening={false}
            />
            {/* Bottom arrowhead */}
            <Line
              points={[-arrowLen * 0.35, arrowLen - arrowLen * 0.35, 0, arrowLen, arrowLen * 0.35, arrowLen - arrowLen * 0.35]}
              stroke="#fff"
              strokeWidth={Math.max(1, 1.5 * s)}
              listening={false}
            />
          </Group>
        )}
      </Group>
    </>
  );
}

