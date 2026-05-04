#!/usr/bin/env python3
"""
Convert photos to WebP at consistent sizes for the gallery.

Both lossless and lossy use the same scaling; only compression differs.
Reads images (JPEG, PNG, GIF, HEIC/HEIF when pillow-heif is installed, etc.) from an input directory and writes:
  - {base}-thumb.webp  — thumbnail, longest side 640px (gallery grid)
  - {base}.webp        — full size, fit within 1920×1080 (lightbox/viewer)

Usage:
  python scripts/convert_photos_to_webp.py [input_dir] [output_dir]

  If omitted, input_dir defaults to: content/photos large/incoming
  If omitted, output_dir defaults to the same as input_dir (writes next to originals).

Examples:
  # Convert incoming photos in place (thumb + full next to originals)
  python scripts/convert_photos_to_webp.py

  # Convert and send to an album folder
  python scripts/convert_photos_to_webp.py "content/photos large/incoming" "content/photos/albums/Sunrises in Wisconsin"

  # Lossy at 95/90 quality (smaller files)
  python scripts/convert_photos_to_webp.py --lossy
"""

import argparse
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    # HEIC/HEIF files require: pip install pillow-heif
    pass

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = WORKSPACE_ROOT / "content" / "photos" / "photos large" / "incoming"

THUMB_MAX = 640
FULL_MAX_W = 1920
FULL_MAX_H = 1080
# Lossy quality (used with --lossy): 95 full, 90 thumb
WEBP_QUALITY_FULL = 95
WEBP_QUALITY_THUMB = 90

# Only process these extensions
IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".tiff",
    ".tif",
    ".heic",
    ".heif",
}


def slug(name: str) -> str:
    """Turn a filename base into a safe, lowercase slug (e.g. for -thumb.webp / .webp)."""
    s = re.sub(r"[^\w\s-]", "", name)
    s = re.sub(r"[-\s]+", "-", s).strip().lower()
    return s or "image"


def resize_max(img: Image.Image, max_px: int) -> Image.Image:
    """Resize image so longest side is at most max_px; preserve aspect ratio."""
    w, h = img.size
    if w <= max_px and h <= max_px:
        return img
    if w >= h:
        new_w = max_px
        new_h = int(round(h * max_px / w))
    else:
        new_h = max_px
        new_w = int(round(w * max_px / h))
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)


def resize_fit_box(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Resize image to fit inside max_w × max_h; preserve aspect ratio."""
    w, h = img.size
    if w <= max_w and h <= max_h:
        return img
    scale = min(max_w / w, max_h / h, 1.0)
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)


def convert_to_webp(
    input_dir: Path,
    output_dir: Path,
    thumb_max: int = THUMB_MAX,
    overwrite: bool = False,
    lossy: bool = False,
) -> list[tuple[str, str]]:
    """Convert images to thumb (640px) + full (fit 1920×1080) webp in output_dir. lossy=True uses quality 95/90."""
    input_dir = input_dir.resolve()
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    converted = []
    for path in sorted(input_dir.iterdir()):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        base = slug(path.stem)
        thumb_path = output_dir / f"{base}-thumb.webp"
        full_path = output_dir / f"{base}.webp"

        if not overwrite and thumb_path.exists() and full_path.exists():
            continue

        try:
            img = Image.open(path)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            elif img.mode != "RGB":
                img = img.convert("RGB")
        except Exception as e:
            print(f"[skip] {path.name}: {e}")
            continue

        thumb = resize_max(img, thumb_max)
        full = resize_fit_box(img, FULL_MAX_W, FULL_MAX_H)
        if lossy:
            thumb.save(thumb_path, "WEBP", quality=WEBP_QUALITY_THUMB, method=6)
            full.save(full_path, "WEBP", quality=WEBP_QUALITY_FULL, method=6)
        else:
            thumb.save(thumb_path, "WEBP", lossless=True, method=6)
            full.save(full_path, "WEBP", lossless=True, method=6)
        converted.append((str(path), base))
        print(f"  {path.name} -> {base}-thumb.webp, {base}.webp")

    return converted


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert photos to WebP: thumb 640px, full max 1920×1080."
    )
    parser.add_argument(
        "input_dir",
        type=Path,
        nargs="?",
        default=DEFAULT_INPUT,
        help=f"Folder containing source images (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "output_dir",
        type=Path,
        nargs="?",
        default=None,
        help="Folder for -thumb.webp and .webp files (default: same as input)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Re-create webp even if they already exist",
    )
    parser.add_argument(
        "--lossy",
        action="store_true",
        help="Use lossy WebP at quality 95 (full) / 90 (thumb) for smaller files",
    )
    args = parser.parse_args()

    input_dir = args.input_dir if args.input_dir.is_absolute() else WORKSPACE_ROOT / args.input_dir
    output_dir = args.output_dir if args.output_dir is not None else input_dir
    if not output_dir.is_absolute():
        output_dir = WORKSPACE_ROOT / output_dir

    if not input_dir.is_dir():
        print(f"[error] Input directory not found: {input_dir}")
        sys.exit(1)

    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print("Mode:   lossy (95/90)" if args.lossy else "Mode:   lossless")
    print("Converting...")
    converted = convert_to_webp(input_dir, output_dir, overwrite=args.overwrite, lossy=args.lossy)
    print(f"Done. Converted {len(converted)} image(s).")


if __name__ == "__main__":
    main()
