/* Shared, dependency-free artwork math. Also loaded by the pixel worker and Node tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArtworkCore=api})(typeof self!=='undefined'?self:globalThis,()=>{
'use strict';
const ratios={'1:1':[1,1],'3:4':[3,4],'9:16':[9,16],'4:3':[4,3],'16:9':[16,9]};
const toneDefaults={brightness:0,exposure:0,contrast:0,saturation:0,highlights:0,shadows:0,warmth:0,tint:0,gamma:1,sharpness:0,grayscale:0,sepia:0,vignette:0};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function dimensions(ratio,size){const [w,h]=ratios[ratio]||ratios['1:1'];return [Math.round(size*w/Math.max(w,h)),Math.round(size*h/Math.max(w,h))]}
function layerDefaults(){return {text:'곡 제목',font:'Malgun Gothic',fontSize:120,color:'#ffffff',weight:'700',align:'center',x:50,y:50,rotation:0,shadowColor:'#000000',shadowBlur:12,shadowX:4,shadowY:4}}
function defaults(sourcePath=''){return {kind:'jjaimsae-artwork',version:2,sourcePath,sourceData:'',ratio:'1:1',size:1600,fit:'cover',background:'#101827',zoom:1,imageX:50,imageY:50,panX:0,panY:0,imageRotation:0,flipX:false,flipY:false,imageVisible:true,paintSettings:{tool:'select',color:'#ffbe3b',size:60,opacity:100,hardness:70},paintLayers:[],baseErase:[],paintSources:{},tones:{...toneDefaults},layers:[]}}
const limits={size:[256,8192],zoom:[.1,5],imageX:[0,100],imageY:[0,100],panX:[-200,200],panY:[-200,200],imageRotation:[-180,180],fontSize:[8,1000],x:[0,100],y:[0,100],rotation:[-180,180],shadowBlur:[0,100],shadowX:[-100,100],shadowY:[-100,100]};
function normalize(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.layers)||value.layers.length>100)throw Error('올바른 이미지 프로젝트가 아닙니다.');
 if(value.kind&&value.kind!=='jjaimsae-artwork')throw Error('다른 종류의 프로젝트입니다.');
 if(value.version>2)throw Error('더 최신 버전의 프로젝트입니다.');
 const p={...defaults(),...value,tones:{...toneDefaults,...value.tones}};
 p.flipX=p.flipX===true;p.flipY=p.flipY===true;
 if(!ratios[p.ratio])p.ratio='1:1';if(!['cover','contain'].includes(p.fit))p.fit='cover';
 for(const [key,[lo,hi]] of Object.entries(limits))if(key in p){const n=Number(p[key]);p[key]=clamp(Number.isFinite(n)?n:lo,lo,hi);}
 const color=v=>/^#[0-9a-f]{6}$/i.test(v);
 if(!color(p.background))p.background='#101827';
 const fonts=['Malgun Gothic','Arial','Georgia','Impact','serif','monospace'];
 p.layers=p.layers.map(l=>{const d={...layerDefaults(),...l};d.text=String(d.text).slice(0,10000);for(const [key,[lo,hi]] of Object.entries(limits))if(key in d)d[key]=clamp(Number(d[key])||0,lo,hi);if(!fonts.includes(d.font))d.font='Malgun Gothic';if(!['left','center','right'].includes(d.align))d.align='center';d.weight=d.weight==='400'?'400':'700';if(!color(d.color))d.color='#ffffff';if(!color(d.shadowColor))d.shadowColor='#000000';return d});
 for(const key of Object.keys(toneDefaults)){const v=Number(p.tones[key]);p.tones[key]=Number.isFinite(v)?clamp(v,key==='gamma'?.2:key==='sharpness'||key==='grayscale'||key==='sepia'||key==='vignette'?0:-100,key==='gamma'?3:100):toneDefaults[key]}
 if(p.sourceData&&(!/^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(p.sourceData)||p.sourceData.length>110*1024*1024))throw Error('프로젝트의 원본 이미지 데이터가 올바르지 않습니다.');
 p.sourcePath=typeof p.sourcePath==='string'?p.sourcePath:'';return p;
}
function imagePlacement(imageWidth,imageHeight,width,height,project){
 const factor=(project.fit==='contain'?Math.min(width/imageWidth,height/imageHeight):Math.max(width/imageWidth,height/imageHeight))*project.zoom;
 const w=imageWidth*factor,h=imageHeight*factor;
 return {x:(width-w)*project.imageX/100+width*(project.panX||0)/100,y:(height-h)*project.imageY/100+height*(project.panY||0)/100,width:w,height:h};
}
function applyTone(data,width,height,values){
 const t={...toneDefaults,...values};if(Object.keys(toneDefaults).every(k=>t[k]===toneDefaults[k]))return data;
 const exposure=2**(t.exposure/50),brightness=t.brightness*2.55,contrast=(1+t.contrast/100)**2,saturation=1+t.saturation/100,gamma=1/t.gamma;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=(y*width+x)*4;if(!data[i+3])continue;
 let r=data[i],g=data[i+1],b=data[i+2],l=(.2126*r+.7152*g+.0722*b)/255;
 const light=(t.shadows*(1-l)**2+t.highlights*l*l)*1.6;
 r=((r*exposure-127.5)*contrast+127.5+brightness+light+t.warmth*.65+t.tint*.25);
 g=((g*exposure-127.5)*contrast+127.5+brightness+light-t.tint*.5);
 b=((b*exposure-127.5)*contrast+127.5+brightness+light-t.warmth*.65+t.tint*.25);
 const gray=.2126*r+.7152*g+.0722*b;r=gray+(r-gray)*saturation;g=gray+(g-gray)*saturation;b=gray+(b-gray)*saturation;
 const mono=t.grayscale/100;r=r*(1-mono)+gray*mono;g=g*(1-mono)+gray*mono;b=b*(1-mono)+gray*mono;
 const sepia=t.sepia/100,rr=r,gg=g,bb=b;
 r=rr*(1-sepia)+(.393*rr+.769*gg+.189*bb)*sepia;g=gg*(1-sepia)+(.349*rr+.686*gg+.168*bb)*sepia;b=bb*(1-sepia)+(.272*rr+.534*gg+.131*bb)*sepia;
 const dx=(x-width/2)/(width/2),dy=(y-height/2)/(height/2),v=1-t.vignette/100*clamp((dx*dx+dy*dy)/2,0,1);
 data[i]=255*(clamp(r,0,255)/255)**gamma*v;data[i+1]=255*(clamp(g,0,255)/255)**gamma*v;data[i+2]=255*(clamp(b,0,255)/255)**gamma*v;
 }
 if(t.sharpness){const copy=new Uint8ClampedArray(data),amount=t.sharpness/100;for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=(y*width+x)*4;for(let c=0;c<3;c++){const blur=(copy[i-width*4+c]+copy[i+width*4+c]+copy[i-4+c]+copy[i+4+c]+copy[i+c]*4)/8;data[i+c]=copy[i+c]+(copy[i+c]-blur)*amount*2}}}
 return data;
}
function bounds(ctx,layer){ctx.font=`${layer.weight} ${layer.fontSize}px "${layer.font}", sans-serif`;const lines=layer.text.split('\n'),width=Math.max(layer.fontSize*.4,...lines.map(line=>ctx.measureText(line).width)),height=lines.length*layer.fontSize*1.2;return {left:layer.align==='left'?0:layer.align==='right'?-width:-width/2,top:-height/2,width,height}}
function localPoint(point,layer,width,height){const x=point.x-width*layer.x/100,y=point.y-height*layer.y/100,a=-layer.rotation*Math.PI/180;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
function upscaleSize(width,height,target){const factor=target/Math.max(width,height),w=Math.round(width*factor),h=Math.round(height*factor);if(factor<=1)throw Error('원본보다 큰 목표 해상도를 선택하세요.');if(w>8192||h>8192||w*h>32000000)throw Error('업스케일은 최대 8192px / 3200만 픽셀까지 지원합니다.');return [w,h]}
function maxOutputSize(ratio){const [a,b]=ratios[ratio]||ratios['1:1'];let size=Math.min(8192,Math.floor(Math.sqrt(32000000*Math.max(a,b)**2/(a*b))));while(dimensions(ratio,size).reduce((a,b)=>a*b)>32000000)size--;return size}
const escapeXML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svg(project,width,height,backgroundData){let defs='',text='';project.layers.forEach((l,i)=>{const id='shadow'+i;defs+=`<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="${l.shadowX}" dy="${l.shadowY}" stdDeviation="${l.shadowBlur/2}" flood-color="${l.shadowColor}"/></filter>`;const lines=l.text.split('\n');text+=`<g transform="translate(${width*l.x/100} ${height*l.y/100}) rotate(${l.rotation})"><text font-family="${escapeXML(l.font)}" font-size="${l.fontSize}" font-weight="${l.weight}" fill="${l.color}" text-anchor="${{left:'start',center:'middle',right:'end'}[l.align]}" dominant-baseline="central" filter="url(#${id})">${lines.map((line,j)=>`<tspan x="0" y="${(j-(lines.length-1)/2)*l.fontSize*1.2}">${escapeXML(line)}</tspan>`).join('')}</text></g>`});return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs><image width="${width}" height="${height}" href="${backgroundData}"/>${text}</svg>`}
return {ratios,toneDefaults,limits,clamp,dimensions,layerDefaults,defaults,normalize,applyTone,bounds,localPoint,upscaleSize,maxOutputSize,imagePlacement,svg};
});
