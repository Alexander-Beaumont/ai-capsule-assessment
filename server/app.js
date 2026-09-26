import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.js';

const fields = ['project_name','prompt_title','prompt_version','prompt_text','response_summary','category','usefulness','reviewed','improved','screenshot_url','notes'];
const choices = {category:['Coding','Writing','Research','Other'],usefulness:['Unrated','Good','Needs Improvement']};
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Provide a valid capsule.');
  const data = {};
  for (const field of fields) {
    const value = body[field];
    if (field === 'reviewed' || field === 'improved') {
      if (![true,false,0,1].includes(value)) throw Error(`${field} must be true or false.`);
      data[field] = Number(value);
    } else {
      if (typeof value !== 'string' || value.length > (field === 'prompt_text' ? 10000 : 2000)) throw Error(`Invalid ${field}.`);
      data[field] = value.trim();
    }
  }
  if (!data.project_name || !data.prompt_title || !data.prompt_text) throw Error('Project, title and prompt are required.');
  if (data.project_name.length > 120 || data.prompt_title.length > 120 || data.prompt_version.length > 32) throw Error('Project, title or version is too long.');
  for (const [field, options] of Object.entries(choices)) if (!options.includes(data[field])) throw Error(`Invalid ${field}.`);
  if (data.screenshot_url) {
    try { if (new URL(data.screenshot_url).protocol !== 'https:') throw Error(); }
    catch { throw Error('Screenshot URL must be HTTPS.'); }
  }
  return data;
}
function cookieValue(name, value, maxAge, secure) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
export function createApp({db = openDatabase(), env = process.env, githubFetch = fetch} = {}) {
  const app = express();
  const prod = env.APP_URL?.startsWith('https://');
  const secret = env.JWT_SECRET;
  const appUrl = env.APP_URL || 'http://localhost:4000';
  const callback = `${appUrl}/auth/github/callback`;
  app.disable('x-powered-by');
  app.use(express.json({limit:'32kb'}));
  app.use(cookieParser());
  const tokenOptions = {algorithm:'HS256', issuer:'ai-capsule', audience:'ai-capsule-web'};
  function requireAuth(req,res,next) {
    try {
      if (!secret || !req.cookies.token) throw Error('Unauthenticated');
      const payload = jwt.verify(req.cookies.token, secret, {
      	algorithms: ['HS256'],
  	issuer: tokenOptions.issuer,
  	audience: tokenOptions.audience
  	});
      if (typeof payload.sub !== 'string' || !/^github:\d+$/.test(payload.sub)) throw Error('Invalid identity');
      req.user = {id:payload.sub, login:payload.login}; next();
    } catch { res.status(401).json({error:'Unauthorized'}); }
  }
  function requireSameOrigin(req,res,next) {
    const origin = req.get('origin');
    if (origin && origin !== appUrl && !( !prod && origin === 'http://localhost:5173')) return res.status(403).json({error:'Forbidden origin'});
    next();
  }
  app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
  app.get('/login',(_req,res)=>res.redirect('/auth/github/start'));
  app.get('/auth/github/start',(_req,res)=>{
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !secret) return res.status(503).send('OAuth is not configured.');
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    res.setHeader('Set-Cookie',[cookieValue('oauth_state',state,600,prod),cookieValue('oauth_verifier',verifier,600,prod)]);
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
    res.redirect(url.href);
  });
  app.get('/auth/github/callback', async(req,res)=>{
    const clear = [cookieValue('oauth_state','',0,prod),cookieValue('oauth_verifier','',0,prod)];
    res.setHeader('Set-Cookie',clear);
    const state = req.query.state;
    const saved = req.cookies.oauth_state;
    if (typeof state !== 'string' || !saved || state.length !== saved.length || !timingSafeEqual(Buffer.from(state),Buffer.from(saved)) || typeof req.query.code !== 'string' || !req.cookies.oauth_verifier) return res.status(400).send('Invalid OAuth callback. Please try logging in again.');
    try {
      const response = await githubFetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:req.query.code,redirect_uri:callback,code_verifier:req.cookies.oauth_verifier})});
      if (!response.ok) throw Error('OAuth exchange failed');
      const exchange = await response.json();
      if (!exchange.access_token || exchange.error) throw Error('OAuth exchange failed');
      const profileResponse = await githubFetch('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json','User-Agent':'ai-capsule-assessment',Authorization:`Bearer ${exchange.access_token}`}});
      if (!profileResponse.ok) throw Error('GitHub profile failed');
      const profile = await profileResponse.json();
      if (!Number.isSafeInteger(profile.id) || profile.id <= 0) throw Error('Invalid GitHub ID');
      const token = jwt.sign({login:String(profile.login || '').slice(0,80)}, secret,{...tokenOptions,subject:`github:${profile.id}`,expiresIn:'8h'});
      res.setHeader('Set-Cookie',[...clear,cookieValue('token',token,8*3600,prod)]);
      res.redirect('/dashboard');
    } catch { res.status(502).send('GitHub sign-in failed. Please try again.'); }
  });
  app.get('/api/me',requireAuth,(req,res)=>res.json({login:req.user.login}));
  app.post('/logout',requireSameOrigin,(_req,res)=>{res.setHeader('Set-Cookie',cookieValue('token','',0,prod));res.json({ok:true});});
  app.use('/api/capsules',requireAuth);
  app.get('/api/capsules',(req,res)=>res.json(db.prepare('SELECT * FROM capsules WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(req.user.id)));
  app.post('/api/capsules',requireSameOrigin,(req,res)=>{
    let data; try { data=validate(req.body); } catch(e) { return res.status(400).json({error:e.message}); }
    const result=db.prepare(`INSERT INTO capsules (user_id,${fields.join(',')}) VALUES (?,${fields.map(()=>'?').join(',')})`).run(req.user.id,...fields.map(f=>data[f]));
    res.status(201).json(db.prepare('SELECT * FROM capsules WHERE id = ? AND user_id = ?').get(result.lastInsertRowid,req.user.id));
  });
  app.put('/api/capsules/:id',requireSameOrigin,(req,res)=>{
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({error:'Not found'});
    let data; try { data=validate(req.body); } catch(e) { return res.status(400).json({error:e.message}); }
    const result=db.prepare(`UPDATE capsules SET ${fields.map(f=>`${f} = ?`).join(',')} WHERE id = ? AND user_id = ?`).run(...fields.map(f=>data[f]),req.params.id,req.user.id);
    if (!result.changes) return res.status(404).json({error:'Not found'});
    res.json(db.prepare('SELECT * FROM capsules WHERE id = ? AND user_id = ?').get(req.params.id,req.user.id));
  });
  app.delete('/api/capsules/:id',requireSameOrigin,(req,res)=>{
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({error:'Not found'});
    const result=db.prepare('DELETE FROM capsules WHERE id = ? AND user_id = ?').run(req.params.id,req.user.id);
    if (!result.changes) return res.status(404).json({error:'Not found'});
    res.json({ok:true});
  });
  const dist = resolve('dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/dashboard',requireAuth,(_req,res)=>res.sendFile(resolve(dist,'index.html')));
    app.get('/',(_req,res)=>res.sendFile(resolve(dist,'index.html')));
  } else app.get('/dashboard',requireAuth,(_req,res)=>res.redirect('http://localhost:5173/dashboard'));
  app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(500).json({error:'Internal server error'});});
  return app;
}
