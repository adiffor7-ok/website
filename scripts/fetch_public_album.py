#!/usr/bin/env python3
"""
Fetch photos from a publicly shared Google Photos album by parsing the share page.

This bypasses the API and extracts image URLs directly from the public album page.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print(
        "[error] Missing dependencies. Install with:",
        "pip install requests beautifulsoup4",
        file=sys.stderr,
        sep="\n",
    )
    sys.exit(1)

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_FILE = WORKSPACE_ROOT / "data" / "google-photos-gallery.json"


def extract_media_urls_from_share_page(share_url: str) -> List[Dict]:
    """
    Extract media URLs (images, videos, etc.) from a publicly shared Google Photos album page.
    
    Note: This parses the HTML/JSON embedded in the page to find all media items.
    """
    print(f"[info] Fetching public album page: {share_url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(share_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        html = response.text
        
        # Google Photos embeds JSON data in the page
        # Look for media data in various formats
        media_items = []
        
        # Method 1: Look for embedded JSON data structures
        # Google Photos stores media data in JSON embedded in script tags or data attributes
        # Try to find JSON arrays with media information
        json_patterns = [
            r'\["AF1Qip[^"]+",\s*"([^"]+)"',  # Album item pattern
            r'"baseUrl"\s*:\s*"([^"]+)"',  # Direct baseUrl pattern
            r'https://lh3\.googleusercontent\.com/[a-zA-Z0-9_\-/]+',  # Direct URL pattern
        ]
        
        # Method 2: Parse with BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        
        # Look for all img tags with Google Photos URLs
        img_tags = soup.find_all('img', src=re.compile(r'lh3\.googleusercontent\.com'))
        for img in img_tags:
            src = img.get('src', '')
            if 'lh3.googleusercontent.com' in src:
                # Extract base URL (remove size parameters)
                base_url = src.split('=')[0] if '=' in src else src
                
                # Try to extract filename from alt text, title, or data attributes
                filename = (
                    img.get('alt', '') or 
                    img.get('title', '') or 
                    img.get('data-filename', '') or
                    img.get('data-title', '') or
                    ''
                )
                
                if base_url and base_url not in [item.get('baseUrl', '') for item in media_items]:
                    media_items.append({
                        'baseUrl': base_url,
                        'thumbnail': f"{base_url}=w640-h640",
                        'full': f"{base_url}=w2048-h2048",
                        'type': 'image',
                        'filename': filename.strip() if filename else None,
                    })
        
        # Look for video elements or video URLs
        video_tags = soup.find_all(['video', 'source'], src=re.compile(r'lh3\.googleusercontent\.com|googleusercontent\.com'))
        for video in video_tags:
            src = video.get('src', '') or video.get('data-src', '')
            if 'googleusercontent.com' in src:
                base_url = src.split('=')[0] if '=' in src else src
                if base_url and base_url not in [item.get('baseUrl', '') for item in media_items]:
                    media_items.append({
                        'baseUrl': base_url,
                        'thumbnail': f"{base_url}=w640-h640" if 'lh3' in base_url else base_url,
                        'full': base_url,
                        'type': 'video',
                    })
        
        # Look for data attributes that might contain media URLs
        for element in soup.find_all(attrs={'data-url': True}):
            url = element.get('data-url', '')
            if 'googleusercontent.com' in url:
                base_url = url.split('=')[0] if '=' in url else url
                if base_url and base_url not in [item.get('baseUrl', '') for item in media_items]:
                    media_type = 'video' if 'video' in element.get('class', []) or 'video' in url.lower() else 'image'
                    media_items.append({
                        'baseUrl': base_url,
                        'thumbnail': f"{base_url}=w640-h640" if 'lh3' in base_url else base_url,
                        'full': f"{base_url}=w2048-h2048" if 'lh3' in base_url and media_type == 'image' else base_url,
                        'type': media_type,
                    })
        
        # Method 3: Look for script tags with embedded JSON data
        script_tags = soup.find_all('script')
        for script in script_tags:
            script_text = script.string or ''
            if not script_text:
                continue
            
            # Look for baseUrl patterns in script content
            base_url_matches = re.findall(r'https://lh3\.googleusercontent\.com/[a-zA-Z0-9_\-/]+', script_text)
            for base_url in base_url_matches:
                # Clean up the URL (remove parameters)
                clean_url = base_url.split('=')[0] if '=' in base_url else base_url
                if clean_url and clean_url not in [item.get('baseUrl', '') for item in media_items]:
                    media_items.append({
                        'baseUrl': clean_url,
                        'thumbnail': f"{clean_url}=w640-h640",
                        'full': f"{clean_url}=w2048-h2048",
                        'type': 'image',
                    })
            
            # Look for JSON data structures that might contain all media items
            # Google Photos often embeds data in window.___INITIAL_STATE___ or similar
            json_patterns = [
                r'window\.___INITIAL_STATE___\s*=\s*({.+?});',
                r'AF_initDataCallback\s*\(\s*({.+?})\s*\)',
                r'"baseUrl"\s*:\s*"([^"]+)"',
            ]
            
            for pattern in json_patterns:
                matches = re.findall(pattern, script_text, re.DOTALL)
                for match in matches:
                    try:
                        # Try to parse as JSON if it looks like JSON
                        if match.strip().startswith('{'):
                            data = json.loads(match)
                            # Recursively search for baseUrl in JSON
                            def find_baseurls(obj, urls=None):
                                if urls is None:
                                    urls = []
                                if isinstance(obj, dict):
                                    for key, value in obj.items():
                                        if key == 'baseUrl' and isinstance(value, str) and 'googleusercontent.com' in value:
                                            clean = value.split('=')[0] if '=' in value else value
                                            if clean not in urls:
                                                urls.append(clean)
                                        else:
                                            find_baseurls(value, urls)
                                elif isinstance(obj, list):
                                    for item in obj:
                                        find_baseurls(item, urls)
                                return urls
                            
                            found_urls = find_baseurls(data)
                            
                            # Also try to find filenames in the JSON
                            def find_filenames(obj, filenames_map=None, current_baseurl=None):
                                if filenames_map is None:
                                    filenames_map = {}
                                if isinstance(obj, dict):
                                    base_url = current_baseurl
                                    filename = None
                                    
                                    # Look for baseUrl first
                                    if 'baseUrl' in obj and isinstance(obj['baseUrl'], str):
                                        base_url = obj['baseUrl'].split('=')[0] if '=' in obj['baseUrl'] else obj['baseUrl']
                                    
                                    # Then look for filename in various possible keys
                                    for key in ['filename', 'name', 'title', 'displayName', 'originalFilename']:
                                        if key in obj and isinstance(obj[key], str) and obj[key]:
                                            # Skip if it looks like metadata (contains "Owner", etc.)
                                            if 'owner' not in obj[key].lower() and len(obj[key]) > 3:
                                                filename = obj[key]
                                                break
                                    
                                    # If we found both, store the mapping
                                    if base_url and filename:
                                        filenames_map[base_url] = filename
                                    
                                    # Recursively search with current baseUrl
                                    for value in obj.values():
                                        find_filenames(value, filenames_map, base_url or current_baseurl)
                                        
                                elif isinstance(obj, list):
                                    for item in obj:
                                        find_filenames(item, filenames_map, current_baseurl)
                                return filenames_map
                            
                            filenames_map = find_filenames(data)
                            
                            for url in found_urls:
                                clean_url = url.split('=')[0] if '=' in url else url
                                if clean_url not in [item.get('baseUrl', '') for item in media_items]:
                                    filename = filenames_map.get(clean_url) or filenames_map.get(url)
                                    media_items.append({
                                        'baseUrl': clean_url,
                                        'thumbnail': f"{clean_url}=w640-h640",
                                        'full': f"{clean_url}=w2048-h2048",
                                        'type': 'image',
                                        'filename': filename,
                                    })
                    except (json.JSONDecodeError, AttributeError):
                        # Not JSON, continue
                        pass
        
        # Deduplicate by baseUrl
        seen = set()
        unique_items = []
        for item in media_items:
            base = item.get('baseUrl', '')
            if base and base not in seen:
                seen.add(base)
                unique_items.append(item)
        
        print(f"[info] Found {len(unique_items)} unique media items")
        return unique_items
        
    except requests.RequestException as e:
        print(f"[error] Failed to fetch album page: {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"[error] Error parsing album page: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return []


def create_gallery_entry(media_data: Dict, index: int) -> Dict:
    """Create a gallery.json entry from extracted media data (images, videos, etc.)."""
    base_url = media_data.get('baseUrl', '')
    media_type = media_data.get('type', 'image')
    thumbnail = media_data.get('thumbnail', f"{base_url}=w640-h640" if base_url else '')
    full = media_data.get('full', f"{base_url}=w2048-h2048" if base_url else '')
    
    # Get filename from extracted data, or generate one
    extracted_filename = media_data.get('filename', '')
    if extracted_filename:
        # Clean up the filename (remove path, keep just the name)
        filename = extracted_filename.split('/')[-1].split('\\')[-1]
        # Remove file extension for caption if it's just a number
        caption = filename.rsplit('.', 1)[0] if '.' in filename else filename
    else:
        # Fallback: generate a name
        if media_type == 'video':
            ext = 'mp4'
            filename = f"video-{index}.{ext}"
            caption = f"Video {index + 1}"
        else:
            ext = 'jpg'
            filename = f"image-{index}.{ext}"
            caption = f"Image {index + 1}"
    
    # Create a clean ID from filename
    clean_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
    clean_id = clean_id.lower().replace(' ', '-').replace('_', '-')
    clean_id = re.sub(r'[^a-z0-9\-]', '', clean_id)
    if not clean_id:
        clean_id = f"google-photos-{index}"
    
    entry = {
        "id": clean_id,
        "thumbnail": thumbnail,
        "full": full,
        "source": "google-photos-public",
        "metadata": {
            "filename": filename,
            "type": media_type,
        },
        "caption": caption,
        "description": "",
        "orientation": "landscape",
    }
    
    return entry


def main():
    import sys
    
    # Get share URL from command line argument or environment variable
    if len(sys.argv) > 1:
        share_url = sys.argv[1]
    elif os.getenv("GOOGLE_PHOTOS_ALBUM_URL"):
        share_url = os.getenv("GOOGLE_PHOTOS_ALBUM_URL")
    else:
        print("[error] No Google Photos album URL provided.", file=sys.stderr)
        print("[info] Usage: python fetch_public_album.py <album_share_url>", file=sys.stderr)
        print("[info] Or set GOOGLE_PHOTOS_ALBUM_URL environment variable", file=sys.stderr)
        return 1
    
    print("[info] Extracting all media items from public Google Photos album...")
    print("[warn] This method parses the HTML page and may be fragile.")
    print("[info] Extracting images, videos, and other media types...\n")
    
    media_data = extract_media_urls_from_share_page(share_url)
    
    if not media_data:
        print("[error] No media items found. The page structure may have changed.", file=sys.stderr)
        print("[info] Try opening the album in a browser and checking if it's truly public.")
        return 1
    
    # Create gallery entries
    gallery_entries = []
    for i, media_item in enumerate(media_data):
        entry = create_gallery_entry(media_item, i)
        gallery_entries.append(entry)
    
    # Merge with existing gallery if it exists
    gallery_file = WORKSPACE_ROOT / "data" / "gallery.json"
    if gallery_file.exists():
        try:
            existing = json.loads(gallery_file.read_text())
            existing_images = existing.get("images", [])
            
            # Get URLs of photos currently in the album
            current_album_urls = set()
            for entry in gallery_entries:
                entry_url = entry.get("thumbnail", "")
                if entry_url:
                    base_url = entry_url.split('=')[0] if '=' in entry_url else entry_url
                    current_album_urls.add(base_url)
            
            # Keep only non-public photos and current public photos
            # Remove public photos that are no longer in the album
            filtered_existing = []
            removed_count = 0
            for img in existing_images:
                if img.get("source") == "google-photos-public":
                    # Check if this photo is still in the album
                    url = img.get("thumbnail", "")
                    if url:
                        base_url = url.split('=')[0] if '=' in url else url
                        if base_url in current_album_urls:
                            # Still in album, keep it (but we'll replace it with fresh data)
                            continue
                        else:
                            # No longer in album, remove it
                            removed_count += 1
                            continue
                # Keep non-public photos
                filtered_existing.append(img)
            
            # Now merge: add new entries, but preserve existing non-public photos
            # Also preserve metadata (like custom names) for existing public photos
            existing_public_urls = {}
            for img in existing_images:
                if img.get("source") == "google-photos-public":
                    url = img.get("thumbnail", "")
                    if url:
                        base_url = url.split('=')[0] if '=' in url else url
                        existing_public_urls[base_url] = img
            
            # Use existing entries if they exist (to preserve custom names), otherwise use new
            merged_public = []
            for entry in gallery_entries:
                entry_url = entry.get("thumbnail", "")
                if entry_url:
                    base_url = entry_url.split('=')[0] if '=' in entry_url else entry_url
                    if base_url in existing_public_urls:
                        # Keep existing entry to preserve custom names/captions
                        merged_public.append(existing_public_urls[base_url])
                    else:
                        # New photo
                        merged_public.append(entry)
            
            combined_images = merged_public + filtered_existing
            
            if removed_count > 0:
                print(f"[info] Removed {removed_count} photos that are no longer in the album")
            
            gallery_data = {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "count": len(combined_images),
                "images": combined_images,
                "albums": existing.get("albums", []),
            }
        except Exception as e:
            print(f"[warn] Could not merge with existing gallery: {e}", file=sys.stderr)
            gallery_data = {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "count": len(gallery_entries),
                "images": gallery_entries,
                "albums": [],
            }
    else:
        gallery_data = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "count": len(gallery_entries),
            "images": gallery_entries,
            "albums": [],
        }
    
    # Write output
    gallery_file.parent.mkdir(parents=True, exist_ok=True)
    gallery_file.write_text(
        json.dumps(gallery_data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    
    print(f"[ok] Generated gallery data with {len(gallery_entries)} photos")
    print(f"[ok] Saved to {gallery_file}")
    print(f"\n[info] Note: These URLs are from the public album page.")
    print(f"[info] They should work in your browser gallery.")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
