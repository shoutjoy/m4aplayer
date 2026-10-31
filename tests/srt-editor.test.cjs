const {test}=require('node:test'),assert=require('node:assert/strict');
const srt=require('../src/srt-editor.js');
test('SRT editing preserves milliseconds, multiline lyrics and CRLF output',()=>{
 const text=srt.serialize([{s:1.234,e:65.678,t:'첫 줄\n둘째 줄'}]);
 assert.equal(text,'1\r\n00:00:01,234 --> 00:01:05,678\r\n첫 줄\n둘째 줄\r\n');
 assert.equal(srt.seconds('01:02:03,456'),3723.456);assert.equal(srt.seconds('01:02:03.456'),3723.456);
 assert.equal(srt.stamp(59.9999),'00:01:00,000');
});
test('SRT rejects malformed timestamps and reversed cue times',()=>{
 assert.ok(Number.isNaN(srt.seconds('00:88:00,000')));assert.ok(Number.isNaN(srt.seconds('bad')));
 assert.throws(()=>srt.serialize([{s:2,e:1,t:'bad'}]));assert.throws(()=>srt.serialize([{s:-1,e:1,t:'bad'}]));
});

test('cue progress resets for each subtitle and follows seeking and subtitle gaps',()=>{
 const cues=[{s:10,e:14},{s:16,e:20}];
 assert.equal(srt.progress(cues,12).ratio,.5);assert.equal(srt.progress(cues,15).index,-1);
 assert.equal(srt.progress(cues,16).ratio,0);assert.equal(srt.progress(cues,19).ratio,.75);
 assert.equal(srt.progress(cues,10).ratio,0);assert.equal(srt.progress([],0).ratio,0);
});
