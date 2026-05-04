#!/usr/bin/env python3
"""
Build data/gallery.json from local media files (no Google Photos).

Scans:
  - content/photos/albums/<AlbumName>/  for:
      - {base}.webp + {base}-thumb.webp pairs
      - {base}.gif when no webp pair for that base (optional {base}-thumb.webp / {base}-thumb.gif)
  - content/photos/photos large/incoming/  for same (album "Incoming")

Writes data/gallery.json and optionally backs up the existing file.
"""

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
ALBUMS_DIR = WORKSPACE_ROOT / "content" / "photos" / "albums"
INCOMING_DIR = WORKSPACE_ROOT / "content" / "photos" / "photos large" / "incoming"
GALLERY_JSON = WORKSPACE_ROOT / "data" / "gallery.json"
BACKUP_SUFFIX = ".google-backup"


def slug(s: str) -> str:
    """Match JS slugifyId: trim, lower, & -> and, non-alphanumeric -> -, trim -."""
    if not s:
        return ""
    s = str(s).strip().lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "image"


def album_key(name: str) -> str:
    """Match JS albumKeyFromName: lower, non-alphanumeric -> -, trim -."""
    if not name:
        return ""
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def humanize(base: str) -> str:
    """Turn slug-like base into a title (e.g. dawning-wheat -> Dawning Wheat)."""
    return base.replace("-", " ").replace("_", " ").title()


def gif_paths_by_stem_lower(folder: Path) -> dict[str, str]:
    """Map stems / slug(stem) -> relative path for each non-thumb *.gif (multiple keys per file)."""
    out: dict[str, str] = {}
    if not folder.is_dir():
        return out
    for path in folder.iterdir():
        if not path.is_file() or path.suffix.lower() != ".gif":
            continue
        if path.name.endswith("-thumb.gif"):
            continue
        stem = path.stem
        rel = path.relative_to(WORKSPACE_ROOT).as_posix()
        out[stem.lower()] = rel
        sk = slug(stem)
        if sk:
            out[sk] = rel
    return out


def collect_media_pairs(folder: Path) -> list[tuple[str, str, str]]:
    """
    Per basename, prefer WebP grid pairs; otherwise accept GIF (animated uploads).

    - {base}.webp requires {base}-thumb.webp (full + thumb).
    - {base}.gif is included only if there is no WebP pair for that base; thumb may be
      {base}-thumb.webp, {base}-thumb.gif, or the GIF itself if neither thumb exists.

    Returns list of (base_name, thumb_rel_path, full_rel_path) relative to site root.
    """
    if not folder.is_dir():
        return []
    pairs: list[tuple[str, str, str]] = []
    webp_base_lowers: set[str] = set()

    for path in folder.iterdir():
        if not path.is_file() or path.suffix.lower() != ".webp":
            continue
        name = path.name
        if name.endswith("-thumb.webp"):
            continue
        base = path.stem
        thumb_path = folder / f"{base}-thumb.webp"
        if not thumb_path.is_file():
            continue
        thumb_rel = thumb_path.relative_to(WORKSPACE_ROOT).as_posix()
        full_rel = path.relative_to(WORKSPACE_ROOT).as_posix()
        pairs.append((base, thumb_rel, full_rel))
        webp_base_lowers.add(base.lower())

    for path in folder.iterdir():
        if not path.is_file() or path.suffix.lower() != ".gif":
            continue
        if path.name.endswith("-thumb.gif"):
            continue
        base = path.stem
        if base.lower() in webp_base_lowers:
            continue
        full_rel = path.relative_to(WORKSPACE_ROOT).as_posix()
        thumb_webp = folder / f"{base}-thumb.webp"
        thumb_gif = folder / f"{base}-thumb.gif"
        if thumb_webp.is_file():
            thumb_rel = thumb_webp.relative_to(WORKSPACE_ROOT).as_posix()
        elif thumb_gif.is_file():
            thumb_rel = thumb_gif.relative_to(WORKSPACE_ROOT).as_posix()
        else:
            thumb_rel = full_rel
        pairs.append((base, thumb_rel, full_rel))

    return sorted(pairs, key=lambda x: x[0].lower())


def build_gallery() -> dict:
    images = []
    albums = []
    image_id_to_index = {}

    # 1) Scan album folders (recurse into subfolders like Cars/BMW)
    if ALBUMS_DIR.is_dir():
        album_dirs = [
            p for p in ALBUMS_DIR.rglob("*")
            if p.is_dir() and collect_media_pairs(p)
        ]
        for album_path in sorted(album_dirs):
            pairs = collect_media_pairs(album_path)
            if not pairs:
                continue
            rel = album_path.relative_to(ALBUMS_DIR)
            album_name = album_path.name
            key = album_key(rel.as_posix().replace("/", "-").replace("\\", "-"))
            if not key:
                continue
            pair_by_base = {p[0]: (p[1], p[2]) for p in pairs}
            gif_lower = gif_paths_by_stem_lower(album_path)
            hover_only_bases = {b for b in pair_by_base if b.endswith("-ue")}
            album_items = []
            for base, thumb_rel, full_rel in pairs:
                if base in hover_only_bases:
                    continue
                image_id = f"{key}-{slug(base)}"
                if image_id in image_id_to_index:
                    continue
                is_gif = full_rel.lower().endswith(".gif")
                fname = f"{base}.gif" if is_gif else f"{base}.webp"
                meta_type = "gif" if is_gif else "image"
                image_entry = {
                    "id": image_id,
                    "thumbnail": thumb_rel,
                    "full": full_rel,
                    "source": "local",
                    "metadata": {"filename": fname, "type": meta_type},
                    "caption": humanize(base),
                    "description": "",
                    "orientation": "landscape",
                }
                if base.endswith("-e"):
                    ue_base = base[:-2] + "-ue"
                    if ue_base in pair_by_base:
                        image_entry["hover"] = pair_by_base[ue_base][1]
                if full_rel.lower().endswith(".webp"):
                    g_rel = gif_lower.get(base.lower()) or gif_lower.get(slug(base))
                    if g_rel:
                        image_entry["fullGif"] = g_rel
                image_id_to_index[image_id] = len(images)
                images.append(image_entry)
                album_item = {"id": image_id, "thumbnail": thumb_rel, "full": full_rel}
                if image_entry.get("fullGif"):
                    album_item["fullGif"] = image_entry["fullGif"]
                album_items.append(album_item)
            albums.append({
                "id": key,
                "name": album_name,
                "description": "",
                "items": album_items,
                "cover": album_items[0]["id"] if album_items else None,
            })

    # 2) Scan incoming folder
    if INCOMING_DIR.is_dir():
        pairs = collect_media_pairs(INCOMING_DIR)
        if pairs:
            key = "incoming"
            pair_by_base = {p[0]: (p[1], p[2]) for p in pairs}
            gif_lower = gif_paths_by_stem_lower(INCOMING_DIR)
            hover_only_bases = {b for b in pair_by_base if b.endswith("-ue")}
            album_items = []
            for base, thumb_rel, full_rel in pairs:
                if base in hover_only_bases:
                    continue
                image_id = f"{key}-{slug(base)}"
                if image_id in image_id_to_index:
                    continue
                is_gif = full_rel.lower().endswith(".gif")
                fname = f"{base}.gif" if is_gif else f"{base}.webp"
                meta_type = "gif" if is_gif else "image"
                image_entry = {
                    "id": image_id,
                    "thumbnail": thumb_rel,
                    "full": full_rel,
                    "source": "local",
                    "metadata": {"filename": fname, "type": meta_type},
                    "caption": humanize(base),
                    "description": "",
                    "orientation": "landscape",
                }
                if base.endswith("-e"):
                    ue_base = base[:-2] + "-ue"
                    if ue_base in pair_by_base:
                        image_entry["hover"] = pair_by_base[ue_base][1]
                if full_rel.lower().endswith(".webp"):
                    g_rel = gif_lower.get(base.lower()) or gif_lower.get(slug(base))
                    if g_rel:
                        image_entry["fullGif"] = g_rel
                image_id_to_index[image_id] = len(images)
                images.append(image_entry)
                album_item = {"id": image_id, "thumbnail": thumb_rel, "full": full_rel}
                if image_entry.get("fullGif"):
                    album_item["fullGif"] = image_entry["fullGif"]
                album_items.append(album_item)
            albums.append({
                "id": key,
                "name": "Incoming",
                "description": "",
                "items": album_items,
                "cover": album_items[0]["id"] if album_items else None,
            })

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(images),
        "images": images,
        "albums": albums,
    }


def main() -> None:
    backup = None
    if GALLERY_JSON.exists():
        backup = GALLERY_JSON.with_suffix(GALLERY_JSON.suffix + BACKUP_SUFFIX)
        shutil.copy2(GALLERY_JSON, backup)
        print(f"Backed up existing gallery to {backup.name}")
    data = build_gallery()
    # Preserve custom album covers from existing gallery when regenerating
    if backup and backup.exists():
        try:
            with open(backup, encoding="utf-8") as f:
                old = json.load(f)
            old_albums = {a["id"]: a for a in old.get("albums", []) if a.get("id")}
            for album in data["albums"]:
                aid = album.get("id")
                old_album = old_albums.get(aid, {})
                old_cover = old_album.get("cover")
                if old_cover:
                    item_ids = {it.get("id") for it in album.get("items", []) if it.get("id")}
                    if old_cover in item_ids:
                        album["cover"] = old_cover
                old_desc = old_album.get("description")
                if isinstance(old_desc, str) and old_desc.strip():
                    album["description"] = old_desc.strip()
                # Per-album ambient background (gallery-renderer.js)
                item_ids = {it.get("id") for it in album.get("items", []) if it.get("id")}
                old_bg_id = old_album.get("albumViewBackgroundId")
                old_bg_path = old_album.get("albumViewBackground")
                if isinstance(old_bg_id, str) and old_bg_id.strip() and old_bg_id.strip() in item_ids:
                    album["albumViewBackgroundId"] = old_bg_id.strip()
                    if isinstance(old_bg_path, str) and old_bg_path.strip():
                        album["albumViewBackground"] = old_bg_path.strip()
                elif isinstance(old_bg_path, str) and old_bg_path.strip():
                    album["albumViewBackground"] = old_bg_path.strip()
        except Exception as e:
            print(f"[warning] Could not preserve covers from backup: {e}")
    GALLERY_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(GALLERY_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Wrote {GALLERY_JSON.name}: {data['count']} images, {len(data['albums'])} albums.")


if __name__ == "__main__":
    main()
