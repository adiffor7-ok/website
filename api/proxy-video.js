// Vercel serverless function to proxy Google Photos video requests
// This adds CORS headers to allow video playback in the browser

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get video URL from query parameter
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    
    // Validate that it's a Google Photos URL (security measure)
    if (!videoUrl.includes('googleusercontent.com')) {
      return res.status(400).json({ error: 'Invalid URL - must be from googleusercontent.com' });
    }
    
    // Fetch the video from Google Photos
    const response = await fetch(videoUrl, {
      headers: {
        'Referer': 'https://photos.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Failed to fetch video',
        status: response.status,
        statusText: response.statusText
      });
    }
    
    // Get content type from response or default to video/mp4
    const contentType = response.headers.get('content-type') || 'video/mp4';
    
    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : parseInt(contentLength, 10) - 1;
        const chunkSize = (end - start) + 1;
        
        res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize);
        res.status(206); // Partial Content
        
        // Stream the requested range
        const videoBuffer = await response.arrayBuffer();
        const videoArray = new Uint8Array(videoBuffer);
        const chunk = videoArray.slice(start, end + 1);
        return res.send(Buffer.from(chunk));
      }
    }
    
    // Stream the full video
    const videoBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(videoBuffer));
    
  } catch (error) {
    console.error('Video proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy video',
      message: error.message 
    });
  }
}
