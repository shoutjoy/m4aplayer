use base64::{engine::general_purpose::STANDARD,Engine};
use serde::{Serialize,Deserialize};
use serde_json::Value;
use std::{collections::HashMap,fs,path::Path};
use super::{Track,PlaylistProject};
const FILE_LIMIT:u64=512*1024*1024;
const ASSET_LIMIT:u64=80*1024*1024;
#[derive(Serialize,Deserialize)] pub struct EmbeddedImage{data:String,extension:String,#[serde(default)] edit:Option<Value>}
fn read_bounded(path:&Path,limit:u64)->Result<Vec<u8>,String>{if fs::metadata(path).map_err(|_|format!("이미지 또는 편집 원본을 찾을 수 없습니다: {}",path.display()))?.len()>limit{return Err(format!("프로젝트에 포함할 파일이 너무 큽니다: {}",path.display()))}fs::read(path).map_err(|e|format!("프로젝트 파일 읽기 실패: {e}"))}
fn extension(bytes:&[u8])->Result<&'static str,String>{if bytes.starts_with(b"\x89PNG\r\n\x1a\n"){Ok("png")}else if bytes.starts_with(b"\xff\xd8\xff"){Ok("jpg")}else if bytes.starts_with(b"GIF8"){Ok("gif")}else if bytes.starts_with(b"RIFF")&&bytes.get(8..12)==Some(b"WEBP"){Ok("webp")}else if bytes.get(4..8)==Some(b"ftyp"){Ok("mp4")}else if bytes.starts_with(b"\x1a\x45\xdf\xa3"){Ok("webm")}else{Err("지원하는 이미지 또는 WebM/MP4 데이터가 아닙니다.".into())}}
fn edit_project(path:&Path)->Result<Option<Value>,String>{let sidecar=path.with_extension("jjimg");if !sidecar.is_file(){return Ok(None)}let mut edit:Value=serde_json::from_slice(&read_bounded(&sidecar,115*1024*1024)?).map_err(|_|format!("이미지 편집 프로젝트가 손상되었습니다: {}",sidecar.display()))?;if edit.get("sourceData").and_then(Value::as_str).unwrap_or("").is_empty(){let source=edit.get("sourcePath").and_then(Value::as_str).filter(|s|!s.is_empty()).ok_or("이미지 편집 프로젝트의 원본이 없습니다.")?;let bytes=read_bounded(Path::new(source),ASSET_LIMIT)?;let ext=extension(&bytes)?;let mime=if ext=="jpg"{"jpeg"}else{ext};edit["sourceData"]=Value::String(format!("data:image/{mime};base64,{}",STANDARD.encode(bytes)))}Ok(Some(edit))}
pub fn pack(tracks:Vec<Track>)->Result<PlaylistProject,String>{
 let mut images=HashMap::new();let mut total=0usize;
 for track in &tracks{for path in track.cover_path.iter().chain(track.cover_paths.iter()){if images.contains_key(path){continue}let bytes=read_bounded(Path::new(path),ASSET_LIMIT)?;let extension=extension(&bytes)?.to_string();let data=STANDARD.encode(bytes);let edit=edit_project(Path::new(path))?;total+=data.len()+edit.as_ref().map(|v|serde_json::to_vec(v).map(|bytes|bytes.len())).transpose().map_err(|e|e.to_string())?.unwrap_or(0);if total>384*1024*1024{return Err("이미지와 편집 데이터가 너무 큽니다. 이미지 크기를 줄이거나 프로젝트를 나누어 저장하세요.".into())}images.insert(path.clone(),EmbeddedImage{data,extension,edit});}}
 Ok(PlaylistProject{version:2,tracks,images})
}
pub fn write(path:&Path,project:&PlaylistProject)->Result<(),String>{let bytes=serde_json::to_vec(project).map_err(|e|e.to_string())?;if bytes.len() as u64>FILE_LIMIT{return Err("이미지를 포함한 프로젝트는 최대 512MB까지 저장할 수 있습니다.".into())}let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();let temp=path.with_file_name(format!(".jjaimsae-{stamp}.tmp"));fs::write(&temp,bytes).map_err(|e|e.to_string())?;if let Err(error)=fs::rename(&temp,path){let _=fs::remove_file(temp);return Err(error.to_string())}Ok(())}
pub fn restore(mut project:PlaylistProject,root:&Path)->Result<Vec<Track>,String>{
 if ![1,2].contains(&project.version){return Err("지원하지 않는 프로젝트 버전입니다.".into())}
 if project.version==1&&project.images.is_empty(){return Ok(project.tracks)}
 for track in &project.tracks{for path in track.cover_path.iter().chain(track.cover_paths.iter()){if !project.images.contains_key(path){return Err(format!("프로젝트에 포함된 이미지가 없습니다: {path}"))}}}
 let mut prepared=vec![];let mut total=0usize;
 for (key,image) in project.images{if image.edit.as_ref().map(|edit|!edit.is_object()).unwrap_or(false){return Err("이미지 편집 프로젝트 형식이 올바르지 않습니다.".into())}if image.data.len()>112*1024*1024{return Err("프로젝트 이미지가 너무 큽니다.".into())}let bytes=STANDARD.decode(&image.data).map_err(|_|"프로젝트 이미지 디코딩 실패")?;let actual=extension(&bytes)?;if actual!=image.extension{return Err("프로젝트 이미지 형식이 올바르지 않습니다.".into())}total+=bytes.len();if total>320*1024*1024{return Err("프로젝트 이미지 합계가 너무 큽니다.".into())}prepared.push((key,actual.to_string(),bytes,image.edit));}
 fs::create_dir_all(root).map_err(|e|e.to_string())?;let mut mapped=HashMap::new();
 for (index,(key,extension,bytes,edit)) in prepared.into_iter().enumerate(){let path=root.join(format!("image_{index}.{extension}"));fs::write(&path,bytes).map_err(|e|e.to_string())?;if let Some(mut edit)=edit{edit["outputPath"]=Value::String(path.to_string_lossy().into_owned());if edit.get("sourceData").and_then(Value::as_str).filter(|v|!v.is_empty()).is_some(){edit["sourcePath"]=Value::String(String::new())}fs::write(path.with_extension("jjimg"),serde_json::to_vec(&edit).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;}mapped.insert(key,path.to_string_lossy().into_owned());}
 for track in &mut project.tracks{if let Some(path)=&mut track.cover_path{*path=mapped.get(path).ok_or("대표 이미지 복원 실패")?.clone()}for path in &mut track.cover_paths{*path=mapped.get(path).ok_or("슬라이드 이미지 복원 실패")?.clone()}}
 Ok(project.tracks)
}
pub fn open(path:&Path,root:&Path)->Result<Vec<Track>,String>{let bytes=read_bounded(path,FILE_LIMIT)?;let file:super::PlaylistProjectFile=serde_json::from_slice(&bytes).map_err(|e|format!("올바른 재생목록 프로젝트가 아닙니다: {e}"))?;match file{super::PlaylistProjectFile::Project(project)=>restore(project,root),super::PlaylistProjectFile::Legacy(tracks)=>Ok(tracks)}}
#[cfg(test)]mod tests{
 use super::*;use std::path::PathBuf;
 fn track(path:&str)->Track{serde_json::from_value(serde_json::json!({"id":"song","path":"audio.wav","name":"Song","format":"WAV","cover_path":path,"cover_paths":[path],"library":false})).unwrap()}
 fn temp()->PathBuf{static NEXT:std::sync::atomic::AtomicUsize=std::sync::atomic::AtomicUsize::new(0);let path=std::env::temp_dir().join(format!("jjaimsae-project-test-{}-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos(),NEXT.fetch_add(1,std::sync::atomic::Ordering::Relaxed)));fs::create_dir_all(&path).unwrap();path}
 #[test]fn embedded_images_and_edit_layers_survive_original_removal(){let folder=temp();let source=folder.join("original.png");let png=b"\x89PNG\r\n\x1a\nTEST";fs::write(&source,png).unwrap();let edit=serde_json::json!({"version":2,"kind":"jjaimsae-artwork","sourcePath":source,"sourceData":format!("data:image/png;base64,{}",STANDARD.encode(png)),"layers":[{"text":"Editable"}],"paintLayers":[]});fs::write(source.with_extension("jjimg"),serde_json::to_vec(&edit).unwrap()).unwrap();let project=pack(vec![track(source.to_str().unwrap()),track(source.to_str().unwrap())]).unwrap();assert_eq!(project.images.len(),1);let file=folder.join("portable.jjp");write(&file,&project).unwrap();fs::remove_file(&source).unwrap();let tracks=open(&file,&folder.join("restored")).unwrap();let restored=PathBuf::from(tracks[0].cover_path.as_ref().unwrap());assert_eq!(fs::read(&restored).unwrap(),png);assert_eq!(tracks[0].cover_paths[0],tracks[1].cover_paths[0]);let edit:Value=serde_json::from_slice(&fs::read(restored.with_extension("jjimg")).unwrap()).unwrap();assert_eq!(edit["layers"][0]["text"],"Editable");fs::remove_dir_all(folder).unwrap();}
 #[test]fn mixed_video_assets_survive_project_roundtrip(){
  let folder=temp();let mp4=folder.join("clip.mp4");let webm=folder.join("clip.webm");
  let mp4_bytes=b"\x00\x00\x00\x18ftypisom";let webm_bytes=b"\x1a\x45\xdf\xa3TEST";
  fs::write(&mp4,mp4_bytes).unwrap();fs::write(&webm,webm_bytes).unwrap();
  let mut song=track(mp4.to_str().unwrap());song.cover_path=None;song.cover_paths.push(webm.to_string_lossy().into_owned());
  let project=pack(vec![song]).unwrap();let restored=restore(project,&folder.join("restored")).unwrap();
  assert_eq!(fs::read(&restored[0].cover_paths[0]).unwrap(),mp4_bytes);
  assert_eq!(fs::read(&restored[0].cover_paths[1]).unwrap(),webm_bytes);
  fs::remove_dir_all(folder).unwrap();
 }
 #[test]fn missing_images_fail_saving_instead_of_creating_broken_project(){assert!(pack(vec![track("missing-nonexistent-cover.png")]).is_err())}
 #[test]fn restore_rejects_missing_assets_and_never_writes_to_original_paths(){let folder=temp();let project=PlaylistProject{version:2,tracks:vec![track("../../outside.png")],images:HashMap::new()};assert!(restore(project,&folder.join("restored")).is_err());assert!(!folder.join("restored").exists());fs::remove_dir_all(folder).unwrap();}
}
