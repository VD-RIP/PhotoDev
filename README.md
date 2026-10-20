# PhotoDev

**PhotoDev** is a modern, high-performance, in-browser photo and graphics editor designed for professional creative workflows. Built with HTML5 Canvas, WebGL, and WebAssembly, PhotoDev provides a full-featured digital imaging workstation directly in your web browser with zero installation required.

---

## Key Features

- **Full Multi-Layer Engine**: 
  - Raster layers, vector shape layers, text layers, and adjustment layers.
  - Non-destructive layer masks, clipping masks, and layer folders.
  - Complete suite of Photoshop-compatible blend modes (Multiply, Screen, Overlay, etc.).
  - Layer styles and effects (Drop Shadow, Stroke, Bevel & Emboss, Color Overlay).

- **Extensive File Format Compatibility**:
  - **Native PSD & PSB Support**: Open and save multi-layer Photoshop projects with full fidelity.
  - **Vector & Publishing Formats**: AI (Adobe Illustrator), PDF, SVG, EPS, CDR.
  - **Standard Raster Formats**: PNG, JPG/JPEG, WEBP, GIF, TIFF, BMP, ICO.
  - **Camera RAW Support**: DNG, CR2, NEF, ARW, and other digital negative formats.

- **Professional Toolset**:
  - Selection tools: Rectangular/Elliptical Marquee, Lasso, Polygonal/Magnetic Lasso, Object Selection, Magic Wand.
  - Retouching tools: Clone Stamp, Healing Brush, Spot Healing, Patch Tool, Content-Aware Fill.
  - Drawing & Painting: Brush engine with customizable pressure, hardness, flow, and dynamics.
  - Vector & Pen Tools: Precise Bézier path editing, shape creation, and typography with font shaping via HarfBuzz WASM.

- **Filters & Adjustments**:
  - Color Adjustments: Curves, Levels, Hue/Saturation, Color Balance, Exposure, Photo Filter, LUT support.
  - Filters: Gaussian Blur, Motion Blur, Liquify, Lens Correction, Sharpening, and Filter Gallery.

- **Browser Website Cache Picture Editing History**:
  - Automatically captures and saves your active multi-layer projects directly into your browser's persistent website cache (`IndexedDB`).
  - Survives page refreshes, tab closures, and computer reboots with zero external server or cloud dependency.
  - Interactive **Recent History** carousel on the start home screen and quick-access topbar **History** modal with live project counts.
  - Complete project cards showing thumbnail previews, project titles, canvas pixel dimensions, memory footprints, and relative timestamps.
  - One-click restoration: instantly reloads and resumes editing any cached project into the active workspace.
  - Intelligent auto-save engine that debounces updates whenever canvas layers or edits are modified, plus manual one-click snapshot options.

- **100% Client-Side Privacy**:
  - All file processing, rendering, and manipulation occur entirely locally on your machine using your CPU, GPU, and WebAssembly.
  - Your files are never uploaded to any remote server.

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (version 16 or newer recommended)
- A modern web browser with WebGL and WebAssembly support (Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari)

### Running Locally

1. Open your terminal in the project directory:
   ```bash
   node server.js
   ```

2. Open your web browser and navigate to:
   ```
   http://127.0.0.1:8888/
   ```

3. Start editing immediately:
   - Click **New Project** to set canvas dimensions and start creating from scratch.
   - Click **Open From Computer** or drag and drop any image or PSD file into the workspace.

---

## Deploying to Netlify

PhotoDev is **100% static and fully pre-configured for instant Netlify deployment** with `netlify.toml` and `_redirects` included.

### Option A: Drag & Drop (Fastest — No Git required)
1. Log in to [Netlify](https://app.netlify.com/).
2. Navigate to the **Sites** tab.
3. Drag and drop this entire project folder into the Netlify upload box.
4. Your site will deploy live immediately with free HTTPS and global CDN delivery!

### Option B: Git Repository (Continuous Deployment)
1. Push this project folder to GitHub, GitLab, or Bitbucket.
2. In Netlify, click **Add new site** > **Import an existing project**.
3. Select your repository.
4. Netlify will automatically detect the settings from `netlify.toml`:
   - **Build command**: *(leave blank)*
   - **Publish directory**: `.`
5. Click **Deploy Site**.

### Option C: Netlify CLI
1. Install and run Netlify CLI in your terminal:
   ```bash
   npx netlify deploy --prod
   ```
2. Follow the prompt to select or create a site.

---

## Project Structure

```
├── index.html              # Main application shell and UI initialization
├── server.js               # Lightweight local development server
├── netlify.toml            # Netlify deployment configuration and headers
├── _redirects              # Netlify client-side routing and mock redirects
├── mock_api.json           # Empty JSON response for mock API calls
├── manifest.json           # Progressive Web App (PWA) manifest
├── favicon.ico             # PhotoDev browser icon
├── sample.bmp              # Demo image asset
├── README.md               # Project documentation
├── code/
│   ├── pp/                 # Core graphics engine, browser editing history cache, and UI controls
│   ├── dbs/                # Asset database, UI iconography, and presets
│   ├── ext/                # Text shaping, vector codecs, and WebAssembly modules
│   └── ext_formats/        # Extended format parsers and loaders
├── style/
│   ├── all10.css           # Workspace theme, toolbar styling, and layout rules
│   └── fonts/              # Embedded typography (Inter Bold)
├── img/                    # Interface graphics and brand assets
├── promo/                  # Application icons (512x512) and metadata badges
└── rsrc/                   # Resource bundles, default shapes, and brush presets
```

---

## Technology Stack

- **Frontend Core**: Vanilla JavaScript (ES6+), HTML5 Canvas 2D Context, WebGL.
- **Typography & Font Shaping**: HarfBuzz WebAssembly (`hb.wasm`) and FriBidi (`fribidi.wasm`).
- **Styling**: Modern CSS3 responsive design with custom UI dark theme and Inter typography.
- **Runtime Server**: Node.js HTTP static server.

---

## Creator & Credits

Developed and maintained by **Vishva Dev**.
