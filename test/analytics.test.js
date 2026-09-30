'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createAnalytics, reportEvents } = require('../src/services/analytics');

test('attribution survives a signed cookie and the journal excludes wallet, IP and query secrets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x402-analytics-'));
  try {
    const analytics = createAnalytics({ directory: dir, key: 'test-secret', now: () => new Date('2026-09-30T00:00:00Z') });
    const req = { method:'GET', path:'/', query:{utm_source:'glama'}, secure:true, get: name => name === 'user-agent' ? 'Mozilla/5.0' : undefined };
    const res = new EventEmitter();res.statusCode=200;let cookie;res.append=(_,value)=>cookie=value;
    analytics.middleware(req,res,()=>{});res.emit('finish');
    const api = { method:'GET', path:'/api/price-feed', query:{secret:'do-not-store'}, get: name=>name==='cookie'?cookie.split(';')[0]:name==='user-agent'?'Mozilla/5.0':undefined };
    const done=new EventEmitter();done.statusCode=200;done.append=()=>{};
    analytics.middleware(api,done,()=>{});
    assert.equal(api.attribution.source,'glama');
    const payer='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    analytics.settled(api,{payer,amount:'1000',txHash:'tx1'},'/api/price-feed');
    analytics.settled(api,{payer,amount:'1000',txHash:'tx2'},'/api/price-feed');
    api.x402={mock:false,txHash:'tx2'};done.emit('finish');
    const text=fs.readFileSync(path.join(dir,'2026-09-30.ndjson'),'utf8');
    assert.ok(!text.includes(payer));assert.ok(!text.includes('do-not-store'));assert.ok(!text.includes('test-secret'));
    const events=text.trim().split('\n').map(JSON.parse);
    const report=reportEvents([...events,...events]); // Two machine exports may overlap.
    assert.equal(report.glama.paid_calls,2);assert.equal(report.glama.usdc,.002);
    assert.equal(report.glama.first_payers,1);assert.equal(report.glama.repeat_payers,1);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('crawler probes are separate from client demand and old settlements are not recounted',()=>{
 const events=[{timestamp:'2026-09-29',event:'payment_settled',payer:'p',transaction:'t1',amount_micro_usdc:'1000',source:'github'},{timestamp:'2026-09-30',event:'payment_settled',payer:'p',transaction:'t1',amount_micro_usdc:'1000',source:'github'},{timestamp:'2026-09-30',event:'payment_settled',payer:'p',transaction:'t2',amount_micro_usdc:'1000',source:'github'},{timestamp:'2026-09-30',event:'payment_challenge',audience:'crawler',source:'nohumans'}];
 const report=reportEvents(events,'2026-09-30');assert.equal(report.github.paid_calls,1);assert.equal(report.github.repeat_payers,1);assert.equal(report.nohumans.payment_challenges,0);assert.equal(report.nohumans.crawler_challenges,1);
});
