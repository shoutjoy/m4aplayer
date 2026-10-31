'use strict';
importScripts('./image-editor-core.js');
self.onmessage=({data})=>{try{const pixels=new Uint8ClampedArray(data.buffer);ArtworkCore.applyTone(pixels,data.width,data.height,data.tones);self.postMessage({id:data.id,buffer:pixels.buffer},[pixels.buffer])}catch(error){self.postMessage({id:data.id,error:String(error)})}};
