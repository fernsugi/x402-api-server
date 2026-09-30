'use strict';

// First-party attribution only: no IPs, raw wallet addresses, full URLs,
// payment signatures, or arbitrary query values enter this journal.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const CHANNELS = new Set(['direct', 'github', 'glama', 'nohumans', 'bazaar', 'reddit', 'x', 'mcp', 'eliza', 'demo', 'test']);
const CAMPAIGNS = new Set(['launch', 'token-check', 'funding-compare', 'swap-cost']);
const BOT = /bot|crawl|spider|probe|healthcheck|health check|monitor|verified-by/i;

function createAnalytics({ directory, key, now = () => new Date() } = {}) {
  const enabled = Boolean(directory && key);
  function hash(value) {
    return crypto.createHmac('sha256', key).update(value).digest('hex').slice(0, 32);
  }
  function write(event) {
    if (!enabled) return;
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const timestamp = now().toISOString();
      fs.appendFileSync(path.join(directory, `${timestamp.slice(0, 10)}.ndjson`), JSON.stringify({ timestamp, ...event }) + '\n', { mode: 0o600 });
    } catch (error) {
      // Analytics must never prevent a valid purchase or change its response.
      console.error('[analytics] journal write failed:', error.code || 'unknown');
    }
  }
  function context(req) {
    const ua = String(req.get('user-agent') || '');
    const cookies = Object.fromEntries(String(req.get('cookie') || '').split(';').map(item => item.trim().split('=')));
    let remembered = {};
    if (enabled && cookies.x402_attribution) {
      const [payload, signature] = cookies.x402_attribution.split('.');
      if (payload && signature && signature === hash(payload)) {
        try { remembered = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { /* ignore invalid cookie */ }
      }
    }
    const suggested = req.query.utm_source || req.query.ref || req.get('x-x402-source');
    let source = CHANNELS.has(suggested) ? suggested : remembered.source || 'direct';
    if (!suggested && source === 'direct') {
      try {
        const host = new URL(req.get('referer')).hostname;
        source = host.endsWith('github.com') ? 'github' : host.endsWith('glama.ai') ? 'glama' : host.endsWith('reddit.com') ? 'reddit' : ['x.com', 'twitter.com', 't.co'].includes(host) ? 'x' : host.endsWith('nohumans.directory') ? 'nohumans' : host === 'agentic.market' ? 'bazaar' : 'direct';
      } catch { /* no usable referrer */ }
    }
    const campaign = CAMPAIGNS.has(req.query.utm_campaign) ? req.query.utm_campaign : remembered.campaign || null;
    const audience = BOT.test(ua) || req.get('x-verified-by') ? 'crawler' : /Mozilla\//.test(ua) ? 'browser' : 'client';
    const session = remembered.session || crypto.randomBytes(16).toString('hex');
    return { source, campaign, audience, session };
  }
  function middleware(req, res, next) {
    req.attribution = context(req);
    if (enabled && req.attribution.audience === 'browser' && (req.path === '/' || req.path.startsWith('/demos'))) {
      const payload = Buffer.from(JSON.stringify(req.attribution)).toString('base64url');
      res.append('Set-Cookie', `x402_attribution=${payload}.${hash(payload)}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`);
    }
    res.on('finish', () => {
      const { source, campaign, audience, session } = req.attribution;
      const common = { source, campaign, audience, route: req.path, status: res.statusCode };
      if (req.method !== 'GET') return;
      if (req.path === '/' || /^\/demos\/(?:index|token-check|funding-compare|swap-cost)\.html$/.test(req.path) || req.path === '/demos/' || req.path === '/demos') {
        write({ event: 'visit', ...common, visitor: enabled ? hash(session) : undefined });
      } else if (req.path === '/get/mcp') {
        write({ event: 'install_click', ...common });
      } else if (/^\/api\/(price-feed|gas-tracker|token-scanner|whale-tracker|funding-rates|dex-quotes|yield-scanner|wallet-profiler)\/?$/.test(req.path)) {
        const event = req.x402 && !req.x402.mock ? 'paid_response' : res.statusCode === 402 ? req.get('x-payment') ? 'payment_rejected' : 'payment_challenge' : res.statusCode === 503 ? 'upstream_unavailable' : res.statusCode === 400 ? 'invalid_input' : null;
        if (event) write({ event, ...common, transaction: req.x402?.txHash || undefined });
      }
    });
    next();
  }
  function settled(req, payment, route) {
    const { source, campaign, audience } = req.attribution || { source: 'direct', campaign: null, audience: 'client' };
    write({ event: 'payment_settled', source, campaign, audience, route, amount_micro_usdc: String(payment.amount), transaction: payment.txHash, payer: enabled ? hash(String(payment.payer).toLowerCase()) : undefined });
  }
  return { enabled, middleware, settled };
}

function reportEvents(events, since = '') {
  const ordered = events.filter(x => x.timestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const first = new Map();
  const transactions = new Set();
  const channels = {};
  for (const event of ordered) {
    if (event.event === 'payment_settled' && event.payer && !first.has(event.payer)) first.set(event.payer, event.transaction);
    if (event.timestamp < since) { if (event.event === 'payment_settled') transactions.add(event.transaction); continue; }
    const channel = channels[event.source] ||= { visits: 0, visitors: new Set(), install_clicks: 0, crawler_challenges: 0, payment_challenges: 0, rejected: 0, upstream_unavailable: 0, paid_calls: 0, amount_micro_usdc: 0n, first_payers: new Set(), repeat_payers: new Set(), delivered: 0, failed_delivery: 0 };
    if (event.event === 'visit' && event.audience !== 'crawler') { channel.visits++; if (event.visitor) channel.visitors.add(event.visitor); }
    if (event.event === 'install_click') channel.install_clicks++;
    if (event.event === 'payment_challenge') event.audience === 'crawler' ? channel.crawler_challenges++ : channel.payment_challenges++;
    if (event.event === 'payment_rejected') channel.rejected++;
    if (event.event === 'upstream_unavailable') channel.upstream_unavailable++;
    if (event.event === 'payment_settled' && event.transaction && !transactions.has(event.transaction)) {
      transactions.add(event.transaction);
      channel.paid_calls++;
      channel.amount_micro_usdc += BigInt(event.amount_micro_usdc);
      (first.get(event.payer) === event.transaction ? channel.first_payers : channel.repeat_payers).add(event.payer);
    }
    if (event.event === 'paid_response') event.status >= 200 && event.status < 300 ? channel.delivered++ : channel.failed_delivery++;
  }
  return Object.fromEntries(Object.entries(channels).map(([name, c]) => [name, { ...c, visitors: c.visitors.size, first_payers: c.first_payers.size, repeat_payers: c.repeat_payers.size, amount_micro_usdc: c.amount_micro_usdc.toString(), usdc: Number(c.amount_micro_usdc) / 1e6 }]));
}

module.exports = { createAnalytics, reportEvents };
