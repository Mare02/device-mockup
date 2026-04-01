/**
 * MockupCanvas
 * ─────────────
 * Konva Stage with infinite-canvas capabilities:
 *   - Pan (hand tool / middle-click)
 *   - Zoom to cursor (scroll)
 *   - Renders all elements as independent Groups
 *   - The wrapper (background) is NOT draggable
 *   - Only the device frame inside the wrapper is draggable
 *   - Selection outline on selected elements
 *   - Move indicator on draggable frames
 *   - Transformer for resize/rotate of selected element
 *   - onTransformEnd properly converts scale → width/height
 */
import { useRef, useCallback, useEffect, useState } from "react";
import { Stage, Layer, Transformer, Group, Rect } from "react-konva";
import type Konva from "konva";
import type { CanvasElement, DeviceFrameElement } from "./types";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_SENSITIVITY, MIN_ELEMENT_SIZE } from "./constants";
import { DeviceFrameShape } from "./DeviceFrameShape";

type Props = {
  elements: CanvasElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateElement: (id: string, changes: Partial<CanvasElement>) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  onZoomChange?: (scale: number) => void;
};

export function MockupCanvas({
  elements,
  selectedId,
  onSelect,
  onUpdateElement,
  stageRef,
  onZoomChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // ── Responsive stage sizing ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setStageSize({ width, height });
      }
    });
    observer.observe(container);
    setStageSize({
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
    });
    return () => observer.disconnect();
  }, []);


  // ── Attach Transformer to selected frame node ──
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (selectedId) {
      const node = stage.findOne(`#frame-${selectedId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, stageRef, elements]);

  // ── Zoom/Pan with trackpad/scroll ──
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      // Cmd+Scroll or Ctrl+Scroll = Zoom
      if (e.evt.metaKey || e.evt.ctrlKey) {
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
          x: (pointer.x - stage.x()) / oldScale,
          y: (pointer.y - stage.y()) / oldScale,
        };

        // Scroll delta can be large, use a smoother multiplier for zoom
        const delta = -e.evt.deltaY;
        const zoomFactor = 1 + delta * ZOOM_SENSITIVITY;
        const newScale = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, oldScale * zoomFactor)
        );

        stage.scale({ x: newScale, y: newScale });
        stage.position({
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        });
        onZoomChange?.(newScale);
      } else {
        // Normal Scroll = Pan
        // Trackpad deltaX/deltaY are already in pixels
        stage.x(stage.x() - e.evt.deltaX);
        stage.y(stage.y() - e.evt.deltaY);
      }

      stage.batchDraw();
    },
    [stageRef, onZoomChange]
  );

  // ── Deselect on empty click ──
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        onSelect(null);
      }
    },
    [onSelect]
  );

  // ── Element event handlers ──

  // Handle frame drag (device frame moved inside its wrapper)
  const handleFrameDragEnd = useCallback(
    (el: CanvasElement) => (e: Konva.KonvaEventObject<DragEvent>) => {
      onUpdateElement(el.id, {
        frameX: e.target.x(),
        frameY: e.target.y(),
      } as any);
    },
    [onUpdateElement]
  );


  // Handle frame transform end (resize/rotate on device frame)
  const handleFrameTransformEnd = useCallback(
    (el: CanvasElement) => (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset node scale — apply to element width/height instead
      node.scaleX(1);
      node.scaleY(1);

      onUpdateElement(el.id, {
        width: Math.max(MIN_ELEMENT_SIZE, el.width * scaleX),
        height: Math.max(MIN_ELEMENT_SIZE, el.height * scaleY),
        rotation: node.rotation(),
        frameX: node.x(),
        frameY: node.y(),
      } as any);
    },
    [onUpdateElement]
  );

  const handleElementClick = useCallback(
    (el: CanvasElement) => (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(el.id);
    },
    [onSelect]
  );


  // ── Render elements ──
  const renderElement = (el: CanvasElement) => {
    const isSelected = el.id === selectedId;
    const isDraggable = !el.locked;

    if (el.type === "device-frame") {
      const df = el as DeviceFrameElement;
      return (
          <DeviceFrameShape
            width={df.width}
            height={df.height}
            modelId={df.modelId}
            basePadding={df.basePadding}
            screenshot={df.screenshot}
            gradient={df.gradient}
            imgProps={df.imgProps}
            shadowIntensity={df.shadowIntensity}
            frameX={df.frameX}
            frameY={df.frameY}
            isSelected={isSelected}
            isDraggable={isDraggable}
            elementId={df.id}
            onFrameDragEnd={handleFrameDragEnd(el)}
            onFrameTransformEnd={handleFrameTransformEnd(el)}
          />
      );
    }
    // Fallback for unknown element types
    return (
      <Rect
        width={el.width}
        height={el.height}
        fill="#333"
        cornerRadius={4}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        draggable={false}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {/* Canvas background grid dots (subtle) */}
          <Rect
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
            fill="#0c0c0f"
            listening={false}
            perfectDrawEnabled={false}
          />

          {/* Render elements */}
          {elements.map((el) => (
              <Group
                key={el.id}
                id={`el-${el.id}`}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                rotation={el.rotation}
                draggable={false}
                onClick={handleElementClick(el)}
                onTap={handleElementClick(el)}
              >
                {renderElement(el)}
              </Group>
          ))}


          {/* Transformer for device frame (resize/rotate) */}
          <Transformer
            ref={transformerRef}
            keepRatio={true}
            rotateEnabled={true}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
            ]}
            boundBoxFunc={(oldBox, newBox) => {
              if (
                Math.abs(newBox.width) < MIN_ELEMENT_SIZE ||
                Math.abs(newBox.height) < MIN_ELEMENT_SIZE
              ) {
                return oldBox;
              }
              return newBox;
            }}
            borderStroke="#6366f1"
            borderStrokeWidth={1.5}
            anchorFill="#6366f1"
            anchorStroke="#ffffff"
            anchorSize={8}
            anchorCornerRadius={2}
            padding={4}
          />
        </Layer>
      </Stage>
    </div>
  );
}
