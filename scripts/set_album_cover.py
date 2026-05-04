#!/usr/bin/env python3
"""
Set a custom cover image for an album.

Usage:
    python3 scripts/set_album_cover.py <album-name> <image-id>

Example:
    python3 scripts/set_album_cover.py "BMW" "image-64"
"""

import json
import sys
import os

def set_album_cover(gallery_path, album_name, image_id):
    """Set the cover image for an album."""
    with open(gallery_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    albums = data.get('albums', [])
    album_found = False
    
    for album in albums:
        # Match by name (case-insensitive) or id
        album_id = album.get('id', '').lower()
        album_name_lower = album.get('name', '').lower()
        search_name = album_name.lower()
        
        if album_id == search_name or album_name_lower == search_name:
            # Verify the image exists in the gallery (but doesn't need to be in the album)
            images = data.get('images', [])
            image_exists = any(img.get('id') == image_id for img in images)
            
            if not image_exists:
                print(f"[error] Image '{image_id}' not found in gallery.")
                return False
            
            # Check if image is in album (informational only)
            items = album.get('items', [])
            image_in_album = any(
                item.get('id') == image_id 
                for item in items 
                if isinstance(item, dict) and 'id' in item
            )
            
            if not image_in_album:
                print(f"[info] Image '{image_id}' is not in the album, but will be used as cover anyway.")
            
            # Set the cover
            album['cover'] = image_id
            album_found = True
            print(f"[ok] Set cover for album '{album.get('name', album_name)}' to '{image_id}'")
            break
    
    if not album_found:
        print(f"[error] Album '{album_name}' not found.")
        print(f"[info] Available albums:")
        for album in albums:
            print(f"  - {album.get('name', album.get('id', 'Unknown'))}")
        return False
    
    # Write back to file
    with open(gallery_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return True

def remove_album_cover(gallery_path, album_name):
    """Remove the custom cover image from an album (revert to default)."""
    with open(gallery_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    albums = data.get('albums', [])
    album_found = False
    
    for album in albums:
        album_id = album.get('id', '').lower()
        album_name_lower = album.get('name', '').lower()
        search_name = album_name.lower()
        
        if album_id == search_name or album_name_lower == search_name:
            if 'cover' in album:
                del album['cover']
                album_found = True
                print(f"[ok] Removed custom cover from album '{album.get('name', album_name)}' (will use first image)")
            else:
                album_found = True
                print(f"[info] Album '{album.get('name', album_name)}' doesn't have a custom cover set")
            break
    
    if not album_found:
        print(f"[error] Album '{album_name}' not found.")
        return False
    
    # Write back to file
    with open(gallery_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return True

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    gallery_path = os.path.join(project_root, 'data', 'gallery.json')
    
    if not os.path.exists(gallery_path):
        print(f"[error] Gallery file not found: {gallery_path}")
        sys.exit(1)
    
    if len(sys.argv) < 3:
        print(__doc__)
        print("\nTo remove a custom cover (revert to default):")
        print("    python3 scripts/set_album_cover.py --remove <album-name>")
        sys.exit(1)
    
    if sys.argv[1] == '--remove':
        album_name = sys.argv[2]
        success = remove_album_cover(gallery_path, album_name)
    else:
        album_name = sys.argv[1]
        image_id = sys.argv[2]
        success = set_album_cover(gallery_path, album_name, image_id)
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()

