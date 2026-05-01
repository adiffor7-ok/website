// Vercel Serverless Function for BrickLink random part
// Uses only Node.js built-in modules (no external dependencies)

const crypto = require('crypto');

// OAuth 1.0a helper function
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  // Create base string
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  
  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;
  
  // Generate signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
  
  return signature;
}

function generateOAuthHeader(method, url, consumerKey, consumerSecret, token, tokenSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_token: token,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp.toString(),
    oauth_nonce: nonce,
    oauth_version: '1.0'
  };
  
  params.oauth_signature = generateOAuthSignature(method, url, params, consumerSecret, tokenSecret);
  
  const authHeader = 'OAuth ' + Object.keys(params)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`)
    .join(', ');
  
  return authHeader;
}

// Common part IDs to choose from
const COMMON_PART_IDS = [
  '3001', '3002', '3003', '3004', '3005', '3022', '3023', '3024',
  '3062', '3063', '4070', '4081', '54200', '54201', '3009', '3010',
  '3011', '3012', '3020', '3021', '3034', '3035', '3036', '3037'
];

async function fetchBrickLinkPart(partId) {
  const url = `https://api.bricklink.com/ws/v1/catalog/item/PART/${partId}`;
  
  const consumerKey = process.env.BRICKLINK_CONSUMER_KEY;
  const consumerSecret = process.env.BRICKLINK_CONSUMER_SECRET;
  const token = process.env.BRICKLINK_TOKEN;
  const tokenSecret = process.env.BRICKLINK_TOKEN_SECRET;
  
  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    throw new Error('Missing BrickLink API credentials');
  }
  
  const authHeader = generateOAuthHeader('GET', url, consumerKey, consumerSecret, token, tokenSecret);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BrickLink API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  return {
    no: data.data.no,
    name: data.data.name,
    color_id: '1', // Default color
    image_url: `https://img.bricklink.com/ItemImage/PN/1/${data.data.no}.png`
  };
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get part of the day based on date
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const partId = COMMON_PART_IDS[dayOfYear % COMMON_PART_IDS.length];
    
    // Fetch part from BrickLink API
    const partData = await fetchBrickLinkPart(partId);
    
    return res.status(200).json(partData);
  } catch (error) {
    console.error('BrickLink API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch part',
      message: error.message 
    });
  }
}
