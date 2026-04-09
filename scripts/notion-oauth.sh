#!/bin/bash
# Notion OAuth Setup Script for Allura Memory

set -e

echo "🔑 Notion OAuth Setup for Allura Memory"
echo "========================================"
echo ""

# Check if NOTION_CLIENT_ID is set
if [ -z "$NOTION_CLIENT_ID" ]; then
    echo "❌ NOTION_CLIENT_ID not set"
    echo ""
    echo "Please set your Notion OAuth credentials:"
    echo "  export NOTION_CLIENT_ID='your-client-id'"
    echo "  export NOTION_CLIENT_SECRET='your-client-secret'"
    echo ""
    echo "To get these:"
    echo "  1. Go to https://www.notion.so/my-integrations"
    echo "  2. Create a new integration"
    echo "  3. Set redirect URI to: http://localhost:3000/oauth/callback"
    echo "  4. Copy Client ID and Client Secret"
    echo ""
    exit 1
fi

if [ -z "$NOTION_CLIENT_SECRET" ]; then
    echo "❌ NOTION_CLIENT_SECRET not set"
    exit 1
fi

echo "✓ Credentials found"
echo ""

# Generate state parameter for security
STATE=$(openssl rand -hex 16)
echo "Generated state: $STATE"

# Build OAuth URL
AUTH_URL="https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback&state=${STATE}"

echo ""
echo "🔗 Opening browser for OAuth authorization..."
echo ""
echo "$AUTH_URL"
echo ""

# Try to open browser (works on Linux with xdg-open)
if command -v xdg-open &> /dev/null; then
    xdg-open "$AUTH_URL" &
else
    echo "Please open this URL in your browser:"
    echo "$AUTH_URL"
fi

echo ""
echo "⏳ Waiting for authorization..."
echo "After authorizing, you'll be redirected to localhost:3000"
echo ""

# Start a simple HTTP server to capture the callback
cat > /tmp/notion-oauth-server.js << 'SERVER_EOF'
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/oauth/callback') {
        const code = parsedUrl.query.code;
        const state = parsedUrl.query.state;
        
        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Error: No authorization code received</h1>');
            return;
        }
        
        console.log('✓ Authorization code received:', code);
        
        // Exchange code for token
        try {
            const response = await fetch('https://api.notion.com/v1/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`
                },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: 'http://localhost:3000/oauth/callback'
                })
            });
            
            const data = await response.json();
            
            if (data.access_token) {
                // Save token to file
                const tokenPath = path.join(process.env.HOME, '.config', 'allura-memory', 'notion-token.json');
                fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
                fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
                
                console.log('✓ Token saved to:', tokenPath);
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>✓ Authorization Successful!</h1>
                        <p>You can close this window and return to Claude Code.</p>
                        <p>Token saved to: ${tokenPath}</p>
                    </body>
                    </html>
                `);
                
                // Exit after a delay
                setTimeout(() => {
                    console.log('\n✓ OAuth flow complete!');
                    console.log('Token saved. You can now use Notion MCP tools.');
                    process.exit(0);
                }, 2000);
            } else {
                console.error('✗ Token exchange failed:', data);
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end(`<h1>Error: ${data.error || 'Unknown error'}</h1>`);
            }
        } catch (error) {
            console.error('✗ Error:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Internal Server Error</h1>');
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(3000, () => {
    console.log('✓ OAuth callback server listening on http://localhost:3000');
});
SERVER_EOF

echo "Starting OAuth callback server..."
node /tmp/notion-oauth-server.js