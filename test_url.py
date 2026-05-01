#!/usr/bin/env python3
import json
import requests

data = json.load(open('data/gallery.json'))
img = data['images'][0]
url = img.get('thumbnail', '')

print(f'Testing URL: {url[:100]}...')
try:
    r = requests.head(url, timeout=5, allow_redirects=True)
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        print('✅ URL is accessible!')
    else:
        print(f'❌ URL returned {r.status_code}')
        print(f'Headers: {dict(r.headers)}')
except Exception as e:
    print(f'❌ Error: {e}')
