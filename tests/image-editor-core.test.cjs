const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/image-editor-core.js');
test('tone processing changes luminance/color and preserves alpha',()=>{
 const p=new Uint8ClampedArray([70,90,110,150,0,0,0,0]);C.applyTone(p,2,1,{brightness:30});assert.ok(p[0]>70&&p[1]>90);assert.equal(p[3],150);assert.deepEqual([...p.slice(4)],[0,0,0,0]);
 const gray=new Uint8ClampedArray([150,80,40,255]);C.applyTone(gray,1,1,{grayscale:100});assert.equal(gray[0],gray[1]);assert.equal(gray[1],gray[2]);
 const original=new Uint8ClampedArray([10,50,90,255]);assert.deepEqual([...C.applyTone(original,1,1,C.toneDefaults)],[10,50,90,255]);
});
test('upscale generates larger raster dimensions and enforces memory limits',()=>{
 assert.deepEqual(C.upscaleSize(800,600,3000),[3000,2250]);assert.equal(3000*2250/(800*600),14.0625);assert.throws(()=>C.upscaleSize(3000,2000,1600));assert.throws(()=>C.upscaleSize(2000,2000,8192));
});
test('project import normalizes numeric values and rejects unsupported embedded sources',()=>{
 assert.throws(()=>C.normalize({kind:'wrong',layers:[]}));assert.throws(()=>C.normalize({...C.defaults(),sourceData:'https://example.com/picture.png'}));const p=C.normalize({...C.defaults(),size:999999,layers:[{fontSize:-10,text:'Editable'}],tones:{gamma:0}});assert.equal(p.size,8192);assert.equal(p.layers[0].fontSize,8);assert.equal(p.tones.gamma,.2);
});
test('SVG embeds its bitmap and retains escaped vector text and transform',()=>{
 const p=C.defaults();p.layers=[{...C.layerDefaults(),text:'A & B <C>',rotation:35}];const svg=C.svg(p,1600,1600,'data:image/png;base64,abc');assert.match(svg,/<text /);assert.match(svg,/A &amp; B &lt;C&gt;/);assert.match(svg,/rotate\(35\)/);assert.match(svg,/href="data:image\/png;base64,abc"/);assert.ok(!svg.includes('<C>'));
});

test('output limit follows aspect ratio and never exceeds 32 megapixels',()=>{
 for(const ratio of Object.keys(C.ratios)){const size=C.maxOutputSize(ratio),[w,h]=C.dimensions(ratio,size);assert.ok(w*h<=32000000);assert.ok(size<=8192);if(size<8192){const [nextW,nextH]=C.dimensions(ratio,size+1);assert.ok(nextW*nextH>32000000)}}
});

test('project normalization preserves zero pan and older project alignment',()=>{
 const p=C.normalize(C.defaults());assert.equal(p.panX,0);assert.equal(p.panY,0);
 const legacy=C.normalize({version:1,ratio:'1:1',size:1600,fit:'cover',zoom:1,imageX:20,imageY:80,layers:[]});assert.equal(legacy.panX,0);assert.equal(legacy.panY,0);assert.equal(legacy.imageX,20);assert.equal(legacy.imageY,80);
});
