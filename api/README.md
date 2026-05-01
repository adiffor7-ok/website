# BrickLink API Backend Setup

This directory contains backend code to fetch random parts from the BrickLink API.

## Option 3: Serverless Platform (Recommended)

### Vercel Setup

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel
   ```

3. **Add Environment Variables** in Vercel Dashboard:
   - Go to your project → Settings → Environment Variables
   - Add these variables:
     - `BRICKLINK_CONSUMER_KEY`
     - `BRICKLINK_CONSUMER_SECRET`
     - `BRICKLINK_TOKEN`
     - `BRICKLINK_TOKEN_SECRET`

4. **Redeploy** after adding environment variables:
   ```bash
   vercel --prod
   ```

5. **Your API endpoint will be:**
   ```
   https://your-project.vercel.app/api/bricklink-random-part
   ```

6. **Update frontend** in `assets/bricklink.js`:
   ```javascript
   const apiUrl = '/api/bricklink-random-part'; // Relative path works on same domain
   ```

### Netlify Setup

1. **Install Netlify CLI** (if not already installed):
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy to Netlify:**
   ```bash
   netlify deploy --prod
   ```

3. **Add Environment Variables** in Netlify Dashboard:
   - Go to your site → Site settings → Environment variables
   - Add the same 4 variables as above

4. **Redeploy** after adding environment variables

5. **Your API endpoint will be:**
   ```
   https://your-site.netlify.app/api/bricklink/random-part
   ```

6. **Update frontend** in `assets/bricklink.js`:
   ```javascript
   const apiUrl = '/api/bricklink/random-part';
   ```

### Option 1: Python/Flask (Local Development)

1. **Install dependencies:**
   ```bash
   pip install flask flask-cors requests requests-oauthlib
   ```

2. **Set environment variables:**
   ```bash
   export BRICKLINK_CONSUMER_KEY="your_consumer_key"
   export BRICKLINK_CONSUMER_SECRET="your_consumer_secret"
   export BRICKLINK_TOKEN="your_token_value"
   export BRICKLINK_TOKEN_SECRET="your_token_secret"
   ```

3. **Run the server:**
   ```bash
   python api/bricklink-random-part.py
   ```

4. **Update frontend URL** in `assets/bricklink.js`:
   ```javascript
   const apiUrl = 'http://localhost:5000/api/bricklink/random-part';
   ```

## Environment Variables

You need these from your BrickLink API registration:
- `BRICKLINK_CONSUMER_KEY`
- `BRICKLINK_CONSUMER_SECRET`
- `BRICKLINK_TOKEN`
- `BRICKLINK_TOKEN_SECRET`

## Testing

Once your backend is running, test it:
```bash
curl http://localhost:5000/api/bricklink/random-part
```

You should get JSON with part data like:
```json
{
  "no": "3001",
  "name": "Brick 2 x 4",
  "color_id": "1",
  "image_url": "https://img.bricklink.com/ItemImage/PN/1/3001.png"
}
```

