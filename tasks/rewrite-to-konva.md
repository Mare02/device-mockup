# Task: Rewrite Rendering Logic to Konva

## Objective
Transition from the current custom-built/manual canvas rendering logic to a robust infinite canvas system using **Konva.js** and **react-konva**. This will enable advanced features like panning, zooming, and interactive element editing (moving, scaling, rotating) which are critical for a professional mockup tool.

## Phase 1: Infrastructure & Core Setup
- [ ] **Dependency Installation**:
    - Add `react-konva` to `package.json`. (https://konvajs.org/docs/react/index.html)
- [ ] **Canvas Foundation**:
    - Create a `MockupCanvas` component using `<Stage>` and `<Layer>`.
    - Implement **Infinite Canvas** logic:
        - Hand tool (panning) via `draggable` on the Stage.
        - Zooming (scroll wheel) with "zoom to point" (cursor) logic.
        - Reset Zoom/Center View functionality.

## Phase 2: Device Mockup Component (The "Board" Item)
- [ ] **Konva Mockup Shell**:
    - Create a custom Konva `Group` that renders the device body:
        - `Rect` with `cornerRadius` for the shell.
        - `Group` with a `clipFunc` or `clip` for the screen area.
        - Render the hardware details (buttons, notches) as Konva shapes.
- [ ] **Dynamic Content**:
    - Load images as `Konva.Image`.
    - Implement proper aspect-ratio handling (Contain vs Cover vs Fill) within the clipped screen group.

## Phase 3: Interactive Editing System
- [ ] **Element Management**:
    - Define a state structure for "Board Elements" (Frames, Text).
    - Support adding multiple device frames to the same board, each with it's own background wrapper (it should have dimensions that are required by the app stores)
- [ ] **Selection & Transform**:
    - Implement a `Transformer` component that anchors to the currently selected element.
    - Enable drag-and-drop for all board items inside screen wrapper (the wrapper itself can only change order).
    - Enable scaling, rotation, and skewing via the Transformer.
- [ ] **Layering**:
    - Allow users to reorder elements (bring to front, send to back).

## Phase 4: UI & Tooling Integration
- [ ] **Contextual Property Panel**:
    - Update the settings panel to reflect the selected Konva object's properties (x, y, scale, rotation, fill, etc.).
- [ ] **Canvas Controls**:
    - Add a floating toolbar for:
        - Cursor/Selection tool.
        - Hand/Pan tool.
        - Add Text / Add Image / Add Frame.
        - Zoom percentage indicator and reset button.
- [ ] **Export System**:
    - Replace the manual `renderMockupToCanvas` logic with `stage.toDataURL()`.
    - Support high-DPI exports by adjusting `pixelRatio` during capture.

## Phase 5: Polish & Refinement
- [ ] **Performance Optimization**:
    - Use `listening={false}` for static background elements.
    - Implement `perfectDrawEnabled={false}` if the canvas feels sluggish with many layers.
- [ ] **Keyboard Shortcuts**:
    - `Space` to toggle hand tool.
    - `Cmd/Ctrl +` and `Cmd/Ctrl -` for zooming.
    - `Delete`/`Backspace` for removing elements.

## References
- [Konva Documentation](https://konvajs.org/)
- [React-Konva Documentation](https://konvajs.org/docs/react/index.html)
- [Infinite Canvas Patterns](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Cursor.html)
