import { readFileSync, existsSync } from 'node:fs';
// Node 22+ supports --env-file; this small loader also works with npm start.
if (existsSync('.env')) for (const line of readFileSync('.env','utf8').split(/\r?\n/)) {
  const match=line.match(/^([A-Z_]+)=(.*)$/); if(match && process.env[match[1]] === undefined) process.env[match[1]]=match[2];
}
import { createApp } from './app.js';
if (process.env.NODE_ENV === 'production') {
  for (const key of ['GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET','JWT_SECRET','APP_URL']) if (!process.env[key]) throw Error(`Missing ${key}`);
  if (!process.env.APP_URL.startsWith('https://') || process.env.JWT_SECRET.length < 32) throw Error('Production requires HTTPS APP_URL and a JWT_SECRET of at least 32 characters.');
}
const port=Number(process.env.PORT || 4000);
createApp().listen(port,'0.0.0.0',()=>console.log(`AI Capsule listening on ${port}`));
