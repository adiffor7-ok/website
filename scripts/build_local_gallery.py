#!/usr/bin/env python3
"""
Build data/gallery.json from local WebP files only (no Google Photos).

Scans:
  - content/photos/albums/<AlbumName>/  for *-thumb.webp + *.webp pairs
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


def collect_webp_pairs(folder: Path) -> list[tuple[str, str, str]]:
    """
    In folder, find all {base}.webp that have {base}-thumb.webp.
    Returns list of (base_name, thumb_rel_path, full_rel_path) with paths relative to site root.
    """
    if not folder.is_dir():
        return []
    pairs = []
    for path in folder.iterdir():
        if not path.is_file() or path.suffix.lower() != ".webp":
            continue
        name = path.name
        if name.endswith("-thumb.webp"):
            continue
        base = path.stem  # e.g. "dawning-wheat" or "Milky Way"
        thumb_path = folder / f"{base}-thumb.webp"
        if not thumb_path.is_file():
            continue
        thumb_rel = thumb_path.relative_to(WORKSPACE_ROOT).as_posix()
        full_rel = path.relative_to(WORKSPACE_ROOT).as_posix()
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
            if p.is_dir() and collect_webp_pairs(p)
        ]
        for album_path in sorted(album_dirs):
            pairs = collect_webp_pairs(album_path)
            if not pairs:
                continue
            rel = album_path.relative_to(ALBUMS_DIR)
            album_name = album_path.name
            key = album_key(rel.as_posix().replace("/", "-").replace("\\", "-"))
            if not key:
                continue
            pair_by_base = {p[0]: (p[1], p[2]) for p in pairs}
            hover_only_bases = {b for b in pair_by_base if b.endswith("-ue")}
            album_items = []
            for base, thumb_rel, full_rel in pairs:
                if base in hover_only_bases:
                    continue
                image_id = f"{key}-{slug(base)}"
                if image_id in image_id_to_index:
                    continue
                image_entry = {
                    "id": image_id,
                    "thumbnail": thumb_rel,
                    "full": full_rel,
                    "source": "local",
                    "metadata": {"filename": f"{base}.webp", "type": "image"},
                    "caption": humanize(base),
                    "description": "",
                    "orientation": "landscape",
                }
                if base.endswith("-e"):
                    ue_base = base[:-2] + "-ue"
                    if ue_base in pair_by_base:
                        image_entry["hover"] = pair_by_base[ue_base][1]
                image_id_to_index[image_id] = len(images)
                images.append(image_entry)
                album_items.append({"id": image_id, "thumbnail": thumb_rel, "full": full_rel})
            albums.append({
                "id": key,
                "name": album_name,
                "description": "",
                "items": album_items,
                "cover": album_items[0]["id"] if album_items else None,
            })

    # 2) Scan incoming folder
    if INCOMING_DIR.is_dir():
        pairs = collect_webp_pairs(INCOMING_DIR)
        if pairs:
            key = "incoming"
            pair_by_base = {p[0]: (p[1], p[2]) for p in pairs}
            hover_only_bases = {b for b in pair_by_base if b.endswith("-ue")}
            album_items = []
            for base, thumb_rel, full_rel in pairs:
                if base in hover_only_bases:
                    continue
                image_id = f"{key}-{slug(base)}"
                if image_id in image_id_to_index:
                    continue
                image_entry = {
                    "id": image_id,
                    "thumbnail": thumb_rel,
                    "full": full_rel,
                    "source": "local",
                    "metadata": {"filename": f"{base}.webp", "type": "image"},
                    "caption": humanize(base),
                    "description": "",
                    "orientation": "landscape",
                }
                if base.endswith("-e"):
                    ue_base = base[:-2] + "-ue"
                    if ue_base in pair_by_base:
                        image_entry["hover"] = pair_by_base[ue_base][1]
                image_id_to_index[image_id] = len(images)
                images.append(image_entry)
                album_items.append({"id": image_id, "thumbnail": thumb_rel, "full": full_rel})
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
        except Exception as e:
            print(f"[warning] Could not preserve covers from backup: {e}")
    GALLERY_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(GALLERY_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Wrote {GALLERY_JSON.name}: {data['count']} images, {len(data['albums'])} albums.")


if __name__ == "__main__":
    main()
