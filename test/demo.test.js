'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
test('demo refuses changed recipient or price before signing and never retries an ambiguous payment',async()=>{
 const { runWorkflow }=await import('../examples/demo.mjs');
 const workflow={title:'test',price_micro:1000,steps:[{name:'Price',url:'/api/price-feed',price_micro:1000}],limits:''};
 const offer={scheme:'exact',network:'base',asset:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',payTo:'0x60264c480b67adb557efEd22Cf0e7ceA792DefB7',maxAmountRequired:'1000',extra:{supportedProofs:['eip3009_transferWithAuthorization']}};
 let signs=0,requests=0;const account={address:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',signTypedData:async()=>{signs++;return '0xfake'}};
 const challenge=o=>new Response(JSON.stringify({x402Version:1,accepts:[o]}),{status:402});
 await assert.rejects(runWorkflow(workflow,{pay:true,account,log:()=>{},fetchFn:async()=>challenge({...offer,payTo:account.address})}),/recipient/);
 await assert.rejects(runWorkflow(workflow,{pay:true,account,log:()=>{},cap:2000,fetchFn:async()=>challenge({...offer,maxAmountRequired:'1500'})}),/price changed/);
 assert.equal(signs,0);
 await assert.rejects(runWorkflow(workflow,{pay:true,account,log:()=>{},fetchFn:async()=>{requests++;if(requests===1)return challenge(offer);throw new Error('network timeout')}}),/timeout/);
 assert.equal(signs,1);assert.equal(requests,2);
});
