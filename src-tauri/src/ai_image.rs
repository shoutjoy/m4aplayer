use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, io::Read, path::PathBuf, sync::{Mutex, atomic::{AtomicBool, Ordering}}, time::{Duration, SystemTime, UNIX_EPOCH}};

const DEFAULT_MODEL:&str="gemini-nano-banana-2.1";
#[derive(Default)] pub struct AiState { key:Mutex<Option<String>>, running:AtomicBool }
#[derive(Serialize,Deserialize)] struct Preferences { model:String }
#[derive(Serialize)] pub struct Settings { configured:bool, saved:bool, model:String }
#[derive(Serialize,Deserialize,Clone)] pub struct AiImage {
 pub id:String,pub path:String,pub prompt:String,pub model:String,pub mode:String,pub aspect_ratio:String,pub created_at:u64,pub response_text:String,
}
#[derive(Deserialize)] pub struct ImageRequest { pub track_id:String,pub prompt:String,pub mode:String,pub aspect_ratio:String,pub size:String,pub image_data:Option<String> }
fn preferences_path()->PathBuf{super::app_root().join("ai-preferences.json")}
fn model()->String{fs::read(preferences_path()).ok().and_then(|data|serde_json::from_slice::<Preferences>(&data).ok()).map(|p|p.model).filter(|v|valid_model(v)).unwrap_or_else(||DEFAULT_MODEL.into())}
fn valid_model(value:&str)->bool{!value.is_empty()&&value.len()<=100&&value.bytes().all(|c|c.is_ascii_alphanumeric()||b"-_.".contains(&c))}
#[cfg(windows)] mod credentials {
 use windows_sys::Win32::{Foundation::{GetLastError,ERROR_NOT_FOUND},Security::Credentials::*};
 fn target()->Vec<u16>{"JJaIMsae Player/GoogleAIStudio".encode_utf16().chain(Some(0)).collect()}
 pub fn read()->Result<Option<String>,String>{unsafe{
  let mut pointer=std::ptr::null_mut();if CredReadW(target().as_ptr(),CRED_TYPE_GENERIC,0,&mut pointer)==0{if GetLastError()==ERROR_NOT_FOUND{return Ok(None)}return Err("Windows 자격 증명을 읽을 수 없습니다.".into())}
  let credential=&*pointer;let result=if credential.CredentialBlobSize==0{Ok(None)}else{String::from_utf8(std::slice::from_raw_parts(credential.CredentialBlob,credential.CredentialBlobSize as usize).to_vec()).map(Some).map_err(|_|"저장된 API 키 형식이 올바르지 않습니다.".into())};CredFree(pointer.cast());result
 }}
 pub fn write(key:&str)->Result<(),String>{unsafe{
  let mut target=target();let mut user:Vec<u16>="Google AI Studio".encode_utf16().chain(Some(0)).collect();let mut credential=CREDENTIALW::default();credential.Type=CRED_TYPE_GENERIC;credential.TargetName=target.as_mut_ptr();credential.UserName=user.as_mut_ptr();credential.CredentialBlobSize=key.len() as u32;credential.CredentialBlob=key.as_ptr() as *mut u8;credential.Persist=CRED_PERSIST_LOCAL_MACHINE;
  if CredWriteW(&credential,0)==0{return Err("API 키를 Windows 자격 증명 관리자에 저장하지 못했습니다.".into())}Ok(())
 }}
 pub fn delete()->Result<(),String>{unsafe{if CredDeleteW(target().as_ptr(),CRED_TYPE_GENERIC,0)==0&&GetLastError()!=ERROR_NOT_FOUND{return Err("저장된 API 키를 삭제하지 못했습니다.".into())}Ok(())}}
}
#[cfg(not(windows))] mod credentials {
 pub fn read()->Result<Option<String>,String>{Ok(None)}
 pub fn write(_: &str)->Result<(),String>{Err("이 환경에서는 이번 실행 동안만 키를 사용할 수 있습니다.".into())}
 pub fn delete()->Result<(),String>{Ok(())}
}
fn current_key(state:&AiState)->Result<Option<String>,String>{let key=state.key.lock().map_err(|_|"API 키 상태 오류")?.clone();if key.is_some(){Ok(key)}else{credentials::read()}}
#[tauri::command] pub fn open_ai_key_page()->Result<(),String>{
 #[cfg(windows)] {let system=PathBuf::from(std::env::var_os("SystemRoot").unwrap_or_else(||"C:\\Windows".into())).join("System32").join("rundll32.exe");super::background_command(system).args(["url.dll,FileProtocolHandler","https://aistudio.google.com/apikey"]).spawn().map_err(|_|"API 키 발급 페이지를 열지 못했습니다.")?;Ok(())}
 #[cfg(not(windows))] {Err("브라우저에서 https://aistudio.google.com/apikey 주소를 열어 주세요.".into())}
}
#[tauri::command] pub fn get_ai_settings(state:tauri::State<AiState>)->Result<Settings,String>{Ok(Settings{configured:current_key(&state)?.is_some(),saved:credentials::read()?.is_some(),model:model()})}
#[tauri::command] pub fn save_ai_settings(state:tauri::State<AiState>,api_key:Option<String>,remember:bool,model:String)->Result<Settings,String>{
 if !valid_model(&model){return Err("모델 ID는 영문·숫자·점·하이픈·밑줄만 사용할 수 있습니다.".into())}
 let key=match api_key.filter(|v|!v.trim().is_empty()){Some(v)=>{let v=v.trim().to_string();if v.len()<20||v.len()>512||!v.bytes().all(|c|c.is_ascii_alphanumeric()||b"-_".contains(&c)){return Err("API 키 형식을 확인하세요.".into())}Some(v)},None=>current_key(&state)?};
 if remember{if let Some(ref key)=key{credentials::write(key)?}}else{credentials::delete()?}
 *state.key.lock().map_err(|_|"API 키 상태 오류")?=key;
 fs::create_dir_all(super::app_root()).map_err(|_|"설정 폴더를 만들 수 없습니다.")?;
 fs::write(preferences_path(),serde_json::to_vec(&Preferences{model:model.clone()}).map_err(|_|"설정 저장 오류")?).map_err(|_|"AI 설정을 저장하지 못했습니다.")?;
 get_ai_settings(state)
}
#[tauri::command] pub fn delete_ai_key(state:tauri::State<AiState>)->Result<(),String>{credentials::delete()?;*state.key.lock().map_err(|_|"API 키 상태 오류")?=None;Ok(())}
fn image_folder(track_id:&str)->Result<PathBuf,String>{super::cover_edit_dir(track_id)?;Ok(super::app_root().join("ai-images").join(track_id))}
#[tauri::command] pub fn list_ai_images(track_id:String)->Result<Vec<AiImage>,String>{
 let folder=image_folder(&track_id)?;if !folder.exists(){return Ok(vec![])}let mut images=vec![];
 for entry in fs::read_dir(folder).map_err(|_|"AI 보관함을 읽을 수 없습니다.")?.flatten(){let path=entry.path().join("manifest.json");if let Ok(data)=fs::read(path){if data.len()<1024*1024{if let Ok(mut found)=serde_json::from_slice::<Vec<AiImage>>(&data){images.append(&mut found)}}}}
 images.retain(|image|PathBuf::from(&image.path).is_file());images.sort_by(|a,b|b.created_at.cmp(&a.created_at).then(b.id.cmp(&a.id)));images.truncate(200);Ok(images)
}
fn request_body(request:&ImageRequest,model:&str)->Result<Value,String>{
 image_folder(&request.track_id)?;
 if request.prompt.trim().is_empty()||request.prompt.chars().count()>10000{return Err("프롬프트는 1~10000자로 입력하세요.".into())}
 if !["generate","edit"].contains(&request.mode.as_str())||!["1:1","3:4","9:16","4:3","16:9"].contains(&request.aspect_ratio.as_str())||!["1K","2K","4K"].contains(&request.size.as_str()){return Err("AI 이미지 요청 설정이 올바르지 않습니다.".into())}
 let mut parts=vec![json!({"text":request.prompt.trim()})];
 if request.mode=="edit"{
  let data=request.image_data.as_deref().ok_or("편집할 이미지가 없습니다.")?;let (prefix,encoded)=data.split_once(",").ok_or("편집 이미지 형식 오류")?;
  let mime=match prefix{"data:image/png;base64"=>"image/png","data:image/jpeg;base64"=>"image/jpeg","data:image/webp;base64"=>"image/webp",_=>return Err("PNG/JPEG/WebP 편집 이미지만 지원합니다.".into())};
  if encoded.len()>16*1024*1024{return Err("AI 편집 입력 이미지는 12MB 이하로 줄여 주세요.".into())}let decoded=STANDARD.decode(encoded).map_err(|_|"편집 이미지 데이터 오류")?;image_extension(&decoded,mime)?;
  parts.push(json!({"inlineData":{"mimeType":mime,"data":encoded}}));
 }
 let mut config=json!({"responseModalities":["TEXT","IMAGE"],"imageConfig":{"aspectRatio":request.aspect_ratio}});
 if model!="gemini-2.5-flash-image"{config["imageConfig"]["imageSize"]=json!(request.size)}
 Ok(json!({"contents":[{"role":"user","parts":parts}],"generationConfig":config}))
}
fn image_extension(bytes:&[u8],mime:&str)->Result<&'static str,String>{match mime{
 "image/png" if bytes.starts_with(b"\x89PNG\r\n\x1a\n")=>Ok("png"),
 "image/jpeg" if bytes.starts_with(b"\xff\xd8\xff")=>Ok("jpg"),
 "image/webp" if bytes.starts_with(b"RIFF")&&bytes.get(8..12)==Some(b"WEBP")=>Ok("webp"),_=>Err("API가 지원되지 않는 이미지 형식을 반환했습니다.".into())}}
fn extract_images(response:&Value)->Result<(Vec<(Vec<u8>,String)>,String),String>{
 let mut images=vec![];let mut text=vec![];
 for candidate in response.get("candidates").and_then(Value::as_array).into_iter().flatten(){for part in candidate.pointer("/content/parts").and_then(Value::as_array).into_iter().flatten(){if part.get("thought").and_then(Value::as_bool)==Some(true){continue}if let Some(t)=part.get("text").and_then(Value::as_str){text.push(t.to_string())}if let Some(inline)=part.get("inlineData").or_else(||part.get("inline_data")){let mime=inline.get("mimeType").or_else(||inline.get("mime_type")).and_then(Value::as_str).unwrap_or("");let encoded=inline.get("data").and_then(Value::as_str).ok_or("API 이미지 데이터가 없습니다.")?;if encoded.len()>100*1024*1024||images.len()>=8{return Err("API 이미지 응답이 너무 큽니다.".into())}let bytes=STANDARD.decode(encoded).map_err(|_|"API 이미지 디코딩 실패")?;image_extension(&bytes,mime)?;images.push((bytes,mime.into()))}}}
 if images.is_empty(){let reason=response.pointer("/promptFeedback/blockReason").and_then(Value::as_str).or_else(||response.pointer("/candidates/0/finishReason").and_then(Value::as_str)).unwrap_or("NO_IMAGE");return Err(format!("이미지가 반환되지 않았습니다 ({reason}). 프롬프트를 바꿔 다시 시도하세요."))}Ok((images,text.join("\n").chars().take(20000).collect()))
}
fn generate(key:String,model:String,request:ImageRequest)->Result<Vec<AiImage>,String>{
 let body=request_body(&request,&model)?;
 let client=reqwest::blocking::Client::builder().timeout(Duration::from_secs(180)).connect_timeout(Duration::from_secs(20)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"AI 연결 초기화 실패")?;
 let response=client.post(format!("https://generativelanguage.googleapis.com/v1/models/{model}:generateContent")).header("x-goog-api-key",&key).json(&body).send().map_err(|e|if e.is_timeout(){"AI 요청 시간이 초과되었습니다. 보관함을 확인한 후 다시 시도하세요."}else{"Google AI에 연결하지 못했습니다. 인터넷 연결을 확인하세요."})?;
 let status=response.status();let mut data=vec![];response.take(115*1024*1024+1).read_to_end(&mut data).map_err(|_|"AI 응답을 읽지 못했습니다.")?;if data.len()>115*1024*1024{return Err("AI 응답이 너무 큽니다.".into())}
 if !status.is_success(){return Err(match status.as_u16(){400=>"요청을 처리하지 못했습니다. 모델·해상도·프롬프트를 확인하세요.",401|403=>"API 키 또는 모델 사용 권한을 확인하세요.",404=>"모델을 찾지 못했습니다. AI 설정에서 사용 가능한 모델 ID를 입력하세요.",429=>"API 사용량 또는 할당량을 초과했습니다. 잠시 후 다시 시도하세요.",_=>"Google AI 서비스 오류입니다. 잠시 후 다시 시도하세요."}.into())}
 let response:Value=serde_json::from_slice(&data).map_err(|_|"AI 응답 형식 오류")?;let (images,text)=extract_images(&response)?;
 let now=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();let id=now.as_nanos().to_string();let folder=image_folder(&request.track_id)?.join(&id);fs::create_dir_all(&folder).map_err(|_|"AI 이미지 보관 폴더 생성 실패")?;let mut records=vec![];
 for (index,(bytes,mime)) in images.into_iter().enumerate(){let ext=image_extension(&bytes,&mime)?;let path=folder.join(format!("image_{}.{}",index+1,ext));fs::write(&path,bytes).map_err(|_|"AI 이미지 저장 실패")?;records.push(AiImage{id:format!("{id}_{index}"),path:path.to_string_lossy().into(),prompt:request.prompt.clone(),model:model.clone(),mode:request.mode.clone(),aspect_ratio:request.aspect_ratio.clone(),created_at:now.as_millis() as u64,response_text:text.clone()})}
 fs::write(folder.join("manifest.json"),serde_json::to_vec_pretty(&records).map_err(|_|"AI 이력 생성 실패")?).map_err(|_|"AI 이력 저장 실패")?;Ok(records)
}
struct Running<'a>(&'a AtomicBool);impl Drop for Running<'_>{fn drop(&mut self){self.0.store(false,Ordering::Release)}}
#[tauri::command] pub async fn ai_generate_image(state:tauri::State<'_,AiState>,request:ImageRequest)->Result<Vec<AiImage>,String>{
 if state.running.compare_exchange(false,true,Ordering::AcqRel,Ordering::Acquire).is_err(){return Err("다른 AI 이미지 요청이 진행 중입니다.".into())}let _running=Running(&state.running);
 let key=current_key(&state)?.ok_or("AI 설정에서 Google AI Studio API 키를 먼저 입력하세요.")?;let model=model();
 tauri::async_runtime::spawn_blocking(move||generate(key,model,request)).await.map_err(|_|"AI 이미지 작업 오류")?
}
#[cfg(test)] mod tests{
 use super::*;
 fn request()->ImageRequest{ImageRequest{track_id:"test-track".into(),prompt:"Draw an album cover".into(),mode:"generate".into(),aspect_ratio:"1:1".into(),size:"2K".into(),image_data:None}}
 #[test]fn validates_request_and_separates_generation_and_edit(){let r=request();let body=request_body(&r,DEFAULT_MODEL).unwrap();assert_eq!(body["contents"][0]["parts"].as_array().unwrap().len(),1);assert_eq!(body["generationConfig"]["imageConfig"]["imageSize"],"2K");let mut edit=request();edit.mode="edit".into();assert!(request_body(&edit,DEFAULT_MODEL).is_err());edit.image_data=Some(format!("data:image/png;base64,{}",STANDARD.encode(b"\x89PNG\r\n\x1a\n")));assert_eq!(request_body(&edit,DEFAULT_MODEL).unwrap()["contents"][0]["parts"].as_array().unwrap().len(),2);assert!(request_body(&r,"gemini-2.5-flash-image").unwrap()["generationConfig"]["imageConfig"].get("imageSize").is_none())}
 #[test]fn parses_only_final_images_and_handles_blocked_response(){let data=STANDARD.encode(b"\x89PNG\r\n\x1a\n");let response=json!({"candidates":[{"content":{"parts":[{"thought":true,"inlineData":{"mimeType":"image/png","data":data}},{"inline_data":{"mime_type":"image/png","data":data}},{"text":"Done"}]}}]});let (images,text)=extract_images(&response).unwrap();assert_eq!(images.len(),1);assert_eq!(text,"Done");assert!(extract_images(&json!({"promptFeedback":{"blockReason":"SAFETY"}})).is_err())}
 #[test]fn rejects_invalid_model_ids(){assert!(valid_model(DEFAULT_MODEL));assert!(!valid_model("../../key"));assert!(!valid_model("model?key=secret"))}
}
