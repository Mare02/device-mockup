# MockupMaster 📱

Professional device mockup and app store screenshot generator built with **Astro**, **React**, and **Tailwind CSS v4**.

## ✨ Features

- **SSR Landing Page**: Optimized for SEO and performance.
- **Interactive Island**: Fully client-side React editor for complex mockup manipulations.
- **Multiple Devices**: iPhone (Notch/Island), Android (Hole/Clean), and classic models.
- **Custom Transforms**: Pan, zoom, and rotate screenshots inside the frames.
- **Creative Backgrounds**: Dozens of preset gradients or custom color pickers.
- **High-Res Export**: Download in PNG or JPEG formats directly from the browser.

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```

2.  **Start the development server**:
    ```bash
    pnpm dev
    ```

3.  **Build for production**:
    ```bash
    pnpm build
    ```

## 📂 Project Structure

- `src/pages/index.astro`: The SEO-optimized landing page.
- `src/pages/app.astro`: The dedicated mockup editor page.
- `src/components/DeviceMockup.tsx`: The core React island for the tool.
- `src/components/ui/`: Reusable shadcn/ui-inspired components.
- `src/styles/global.css`: Tailwind CSS v4 configuration and global styles.

## 🛠 Tech Stack

- **Framework**: Astro 6.x
- **UI Library**: React 19.x
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Primitive UI**: Radix UI
