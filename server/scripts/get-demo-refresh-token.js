/**
 * One-time script to get GOOGLE_DEMO_REFRESH_TOKEN.
 * Uses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as the app.
 * Run from server/: node scripts/get-demo-refresh-token.js
 * Then open the printed URL in a browser, sign in with the Google account
 * that should own demo calendar events, and copy the printed refresh_token
 * into .env as GOOGLE_DEMO_REFRESH_TOKEN.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const scopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: scopes,
});

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/oauth2callback')) {
    const q = url.parse(req.url, true).query;
    if (q.error) {
      res.end('Error: ' + q.error + (q.error_description ? ' - ' + q.error_description : ''));
      server.close();
      return;
    }
    try {
      const { tokens } = await oauth2Client.getToken(q.code);
      res.end(
        '<pre>Add this to your .env as GOOGLE_DEMO_REFRESH_TOKEN:\n\n' +
        tokens.refresh_token +
        '\n</pre>'
      );
    } catch (e) {
      res.end('Failed to get token: ' + e.message);
    }
    server.close();
  }
}).listen(3000, () => {
  console.log('Open this URL in a browser (use the Google account that should own demo meetings):');
  console.log(authUrl);
  console.log('\nRedirect URI must be: ' + redirectUri);
});
