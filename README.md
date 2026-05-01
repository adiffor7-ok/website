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

