/* Replayable paint layers use normalized coordinates so exports retain output resolution. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArtworkPaint=api})(typeof self!=='undefined'?self:globalThis,()=>{
'use strict';
const settings=()=>({tool:'select',color:'#ffbe3b',size:60,opacity:100,hardness:70});
function cloneLayer(layer){return {...layer,strokes:layer.strokes.map(s=>({...s,points:s.points.map(p=>({...p}))}))}}
function normalize(value){
 const p={...value,paintSettings:{...settings(),...value.paintSettings},paintLayers:value.paintLayers||[],baseErase:value.baseErase||[],paintSources:value.paintSources||{},imageVisible:value.imageVisible!==false};
 if(!['select','eraser','clone','brush','pen','highlighter'].includes(p.paintSettings.tool))p.paintSettings.tool='select';
 const clamp=(v,a,b,f)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):f;
 p.paintSettings.size=clamp(p.paintSettings.size,1,500,60);p.paintSettings.opacity=clamp(p.paintSettings.opacity,0,100,100);p.paintSettings.hardness=clamp(p.paintSettings.hardness,0,100,70);
 if(!/^#[a-f\d]{6}$/i.test(p.paintSettings.color))p.paintSettings.color='#ffbe3b';
 if(!Array.isArray(p.paintLayers)||p.paintLayers.length>16||!Array.isArray(p.baseErase)||Object.keys(p.paintSources).length>32)throw Error('그림 레이어 또는 복제 원본이 너무 많습니다.');
 let count=0;function strokes(items){if(!Array.isArray(items)||items.length>2000)throw Error('붓 작업이 너무 많습니다.');return items.map(s=>{if(!['eraser','clone','brush','pen','highlighter'].includes(s.tool)||!Array.isArray(s.points)||!s.points.length)throw Error('올바르지 않은 붓 작업입니다.');count+=s.points.length;if(count>200000)throw Error('그림 프로젝트가 너무 큽니다.');return {...s,size:clamp(s.size,.0001,2,.04),opacity:clamp(s.opacity,0,1,1),hardness:clamp(s.hardness,0,1,1),color:/^#[a-f\d]{6}$/i.test(s.color)?s.color:'#000000',offsetX:clamp(s.offsetX,-4,4,0),offsetY:clamp(s.offsetY,-4,4,0),points:s.points.map(point=>({x:clamp(point.x,-1,2,0),y:clamp(point.y,-1,2,0),pressure:clamp(point.pressure,.05,1,1)}))}})}
 p.baseErase=strokes(p.baseErase).map(s=>({...s,tool:'eraser'}));p.paintLayers=p.paintLayers.map((l,i)=>({id:String(l.id||i),name:String(l.name||'그림 레이어').slice(0,80),visible:l.visible!==false,opacity:clamp(l.opacity,0,1,1),strokes:strokes(l.strokes)}));
 let bytes=0;for(const source of Object.values(p.paintSources)){if(typeof source!=='string'||!/^data:image\/png;base64,[a-z\d+/=]+$/i.test(source))throw Error('복제 도장의 원본이 올바르지 않습니다.');bytes+=source.length}if(bytes>100*1024*1024)throw Error('복제 원본은 총 100MB까지 저장할 수 있습니다.');
 for(const l of p.paintLayers)for(const s of l.strokes)if(s.tool==='clone'&&!p.paintSources[s.sourceId])throw Error('복제 도장의 원본이 없습니다.');return p;
}
function stroke(ctx,s,width,height,getSource){
 const radius=Math.max(.5,s.size*width/2);const source=s.tool==='clone'?getSource(s.sourceId):null;if(s.tool==='clone'&&!source)return;
 let cloneStamp=null;
 if(source&&s.hardness<1&&ctx.canvas?.ownerDocument){const diameter=Math.max(2,Math.ceil(radius*2));cloneStamp=ctx.canvas.ownerDocument.createElement('canvas');cloneStamp.width=cloneStamp.height=diameter;}
 const stamp=(x,y,pressure)=>{const r=radius*(s.tool==='pen'?pressure:1);ctx.save();ctx.globalAlpha=s.opacity;ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':s.tool==='highlighter'?'multiply':'source-over';
 if(source){if(cloneStamp){const d=cloneStamp.width,c=cloneStamp.getContext('2d');c.clearRect(0,0,d,d);c.globalCompositeOperation='source-over';c.drawImage(source,0,0,source.width,source.height,s.offsetX*width-x+r,s.offsetY*height-y+r,width,height);c.globalCompositeOperation='destination-in';const gradient=c.createRadialGradient(r,r,r*s.hardness,r,r,r);gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gradient;c.fillRect(0,0,d,d);ctx.drawImage(cloneStamp,x-r,y-r)}else{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();ctx.drawImage(source,0,0,source.width,source.height,s.offsetX*width,s.offsetY*height,width,height)}}
 else if(s.tool==='highlighter'){ctx.fillStyle=s.color;ctx.fillRect(x-r,y-r*.3,r*2,r*.6)}
 else {if(s.hardness<1){const gradient=ctx.createRadialGradient(x,y,r*s.hardness,x,y,r);gradient.addColorStop(0,s.tool==='eraser'?'rgba(0,0,0,1)':s.color);gradient.addColorStop(1,s.tool==='eraser'?'rgba(0,0,0,0)':s.color+'00');ctx.fillStyle=gradient}else ctx.fillStyle=s.tool==='eraser'?'#000000':s.color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.restore()};
 let previous;for(const point of s.points){const x=point.x*width,y=point.y*height;if(previous){const distance=Math.hypot(x-previous.x,y-previous.y),steps=Math.max(1,Math.ceil(distance/Math.max(1,radius*.3)));for(let i=1;i<=steps;i++){const t=i/steps;stamp(previous.x+(x-previous.x)*t,previous.y+(y-previous.y)*t,point.pressure??1)}}else stamp(x,y,point.pressure??1);previous={x,y}}
 if(cloneStamp)cloneStamp.width=cloneStamp.height=1;
}
function erase(ctx,strokes,width,height){for(const s of strokes||[])stroke(ctx,s,width,height,()=>null)}
function render(ctx,project,width,height,makeCanvas,getSource){for(const layer of project.paintLayers||[]){if(!layer.visible||!layer.opacity)continue;const canvas=makeCanvas();canvas.width=width;canvas.height=height;try{const target=canvas.getContext('2d');for(const s of layer.strokes)stroke(target,s,width,height,getSource);ctx.save();ctx.globalAlpha=layer.opacity;ctx.drawImage(canvas,0,0);ctx.restore()}finally{canvas.width=canvas.height=1}}}
return {settings,cloneLayer,normalize,stroke,erase,render};
});
