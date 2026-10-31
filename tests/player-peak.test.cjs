const {test}=require('node:test'),assert=require('node:assert/strict');
const {tracker}=require('../src/player-peak.js');
test('sample peak reads decibels, holds transients and identifies digital clipping',()=>{
 const t=tracker();assert.ok(Math.abs(t.update(.5,0,'a',0,true).current+6.0206)<.0001);
 assert.equal(t.update(1,100,'a',.1,true).clipped,true);
 assert.equal(t.update(.1,1100,'a',1.1,true).held,0);
 assert.equal(t.update(.1,2200,'a',2.2,true).held,-20);
 assert.equal(t.update(0,2300,'a',2.2,false).current,-Infinity);
});
test('song changes and seeking clear a previous peak hold',()=>{
 const t=tracker();t.update(1,0,'a',10,true);
 assert.equal(t.update(.1,100,'b',0,true).held,-20);
 t.update(1,200,'b',.1,true);assert.equal(t.update(.01,300,'b',8,true).held,-40);
});

test('peak history retains one maximum per second, shifts after ten records and resets on seek',()=>{
 const log=require('../src/player-peak.js').history();log.update(0,'a',0,true);
 log.update(1,'a',.5,true);let records=log.update(.1,'a',1,true);assert.equal(records[0].value,0);
 for(let i=2;i<=12;i++)records=log.update(.5,'a',i,true);
 assert.equal(records.length,10);assert.equal(records[0].time,3);assert.equal(records[9].time,12);
 assert.equal(log.update(1,'a',12,false).length,10);
 assert.equal(log.update(.1,'a',0,true).length,0);
 assert.equal(log.update(.1,'b',0,true).length,0);
});

test('spectrum caps hold each bar independently, freeze on pause and clear on song or seek',()=>{
 const t=require('../src/player-peak.js').spectrumTracker();
 assert.deepEqual(t.update([100,200],'a',0,true),[100,200]);
 assert.deepEqual(t.update([80,230],'a',.5,true),[100,230]);
 assert.deepEqual(t.update([20,30],'a',1,true),[100,230]);
 assert.deepEqual(t.update([20,30],'a',2.1,true),[20,230]);
 assert.deepEqual(t.update([1,1],'a',2.6,false),[20,230]);
 assert.deepEqual(t.update([1,2],'a',0,true),[1,2]);
 assert.deepEqual(t.update([3,4],'b',0,true),[3,4]);
});
