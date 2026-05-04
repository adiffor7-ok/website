# Photo Spectrum

Photo gallery website that runs on **local WebP files** (no Google Photos).

## Setup: local photo gallery

1. **Convert photos to WebP** (thumbnail 640px, full at original size):
   ```bash
   # Default: lossless (best quality, larger files)
   python scripts/convert_photos_to_webp.py

   # Or lossy at 95/90 quality (smaller files): add --lossy
   python scripts/convert_photos_to_webp.py --lossy

   # Convert into an album folder
   python scripts/convert_photos_to_webp.py "content/photos/photos large/incoming" "content/photos/albums/My Album"
   ```
   This creates `{name}-thumb.webp` and `{name}.webp` in the output folder.

2. **Build the gallery data** from your local folders:
   ```bash
   python scripts/build_local_gallery.py
   ```
   This scans `content/photos/albums/<AlbumName>/` and `content/photos/photos large/incoming/` for `*-thumb.webp` + `*.webp` pairs, then overwrites `data/gallery.json`. Your previous `data/gallery.json` is backed up to `data/gallery.json.google-backup` the first time you run it.

3. **Preview:** Put WebP files in album folders (or leave them in `incoming` for the “Incoming” album), run `build_local_gallery.py`, then serve and open the site (see below).

## Model-Based Layouts

The gallery supports model-based layouts for different photo counts:
- **Model 4**: 4 photos (2:3 aspect ratio, portrait/landscape mix)
- **Model 9**: 9 photos (square thumbnails, 3 columns)
- **Model 19**: 19 photos (column-based layout)

Layout models are defined in `assets/css/styles.css` and automatically applied based on photo count.

## Preview locally

Serve the project root:

```bash
python -m http.server 8000
```

Visit `http://localhost:8000`.

## Deploy (GitHub + Vercel)

Source repo: [github.com/adiffor7-ok/website](https://github.com/adiffor7-ok/website).

This project is a **static site from the repository root** plus a few **Vercel Serverless Functions** under `api/`. [`vercel.json`](vercel.json) sets `outputDirectory` to `.` and a no-op build command, so what you push to Git is what gets served.

### Connect GitHub to Vercel

1. In the [Vercel dashboard](https://vercel.com), open your team **adiffor7-oks-projects** (or the account that owns the deployment).
2. **Add New… → Project** → **Import** [adiffor7-ok/website](https://github.com/adiffor7-ok/website).
3. Use the defaults that match `vercel.json`: **Root Directory** `.`, **Framework** Other (or leave framework unset). Vercel will use the config file’s `buildCommand` and `outputDirectory`.
4. **Deploy.** Every push to the connected **production branch** (usually `main`) triggers a new production deployment.

### After you add photos locally

Run `convert_photos_to_webp.py` and `build_local_gallery.py`, then **commit and push** `content/` and `data/gallery.json` (and any HTML/CSS/JS changes). Vercel does not run those Python scripts on deploy unless you add a build step—your live gallery is whatever is in the repo.

### Quick commit from the repo root (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/commit.ps1 -Message "Rebuild gallery and photos" -Push
```

Omit `-Push` if you only want a local commit. On Git Bash: ` ./scripts/commit.sh "your message" push`.

### API routes on Vercel

Functions in `api/` (for example `api/bricklink-random-part.js`) need any **environment variables** configured in the Vercel project: **Settings → Environment Variables**. See [`api/README.md`](api/README.md) for BrickLink variables and naming.

### Service worker / caching

The site ships a service worker (`sw.js`). After a deploy, if old assets stick around in the browser, do a hard refresh or clear site data for your Vercel URL so clients pick up new `sw.js` or `gallery.json` versions.

