const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function load(){const context={window:{},document:{getElementById:()=>null},module:undefined};vm.createContext(context);vm.runInContext(fs.readFileSync('src/mastering/effector/EQ/eq.js','utf8')+'\nthis.Engine=EQEffector;',context);vm.runInContext(fs.readFileSync('src/player-eq.js','utf8'),context);return context}
test('player EQ normalizes saved values and preserves independent song settings',()=>{const c=load(),normalize=c.window.JJaIMsaePlayerEQ.normalize;const raw={eq:[50,-50,'2.5',null],eqEnabled:true};const a=normalize(raw),b=normalize(null);assert.equal(a.eq.length,20);assert.deepEqual(Array.from(a.eq.slice(0,4)),[12,-12,2.5,0]);a.eq[0]=4;assert.equal(b.eq[0],0);assert.equal(b.eqEnabled,false);assert.equal(raw.eq[0],50)});
test('mastering EQ engine connects two independent sets of twenty filters',()=>{const c=load(),nodes=[];const node=()=>({connect(target){this.next=target},gain:{value:0},frequency:{},Q:{}});const ctx={createAnalyser:node,createBiquadFilter(){const n=node();nodes.push(n);return n}};const song={eq:Array(20).fill(2),eqEnabled:true},global={eq:Array(20).fill(-1),eqEnabled:false};const a=new c.Engine(song),b=new c.Engine(global),src=node();const mid=a.connect(ctx,src,false),out=b.connect(ctx,mid,false);assert.equal(nodes.length,40);assert.equal(nodes[0].gain.value,2);assert.equal(nodes[20].gain.value,0);assert.equal(nodes[0].type,'lowshelf');assert.equal(nodes[19].type,'highshelf');assert.notEqual(mid,out);assert.equal(a.qValue,1.15)});

test('graph dragging locks a band, clamps gain, enables EQ and follows the save callback',()=>{
 const c=load();
 vm.runInContext(fs.readFileSync('src/player-eq.js','utf8').replace('window.JJaIMsaePlayerEQ=', 'window.bindGraphEditing=bindGraphEditing;window.JJaIMsaePlayerEQ='),c);
 const state={eq:Array(20).fill(0),eqEnabled:false},effect=new c.Engine(state);
 let changes=0,allowed=true,captured=false;
 effect.canvas={getBoundingClientRect:()=>({left:0,top:0,width:1000,height:250}),setPointerCapture(){captured=true},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false}};
 effect.drawEQCanvas=()=>{};
 c.window.bindGraphEditing(effect,()=>allowed,()=>changes++);
 const x=effect.freqToX(1000,48,934),event=(y,clientX=x)=>({button:0,pointerId:1,clientX,clientY:y});
 effect.canvas.onpointerdown(event(70));
 assert.equal(state.eqEnabled,true);assert.equal(effect.dragBandIndex,9);assert.ok(state.eq[9]>0);assert.equal(captured,true);
 effect.canvas.onpointermove(event(-100,900));assert.equal(state.eq[9],12);assert.equal(state.eq[19],0);
 effect.canvas.onpointermove(event(500));assert.equal(state.eq[9],-12);
 effect.canvas.onpointerup(event(500));assert.equal(captured,false);assert.equal(effect.dragBandIndex,-1);
 effect.canvas.ondblclick(event(100));assert.equal(state.eq[9],0);assert.equal(changes,4);
 allowed=false;effect.canvas.onpointerdown(event(50));effect.canvas.ondblclick(event(50));assert.equal(changes,4);
});
