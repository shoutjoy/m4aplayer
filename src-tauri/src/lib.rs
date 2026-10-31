mod portable_project;
mod ai_image;
use serde::{Deserialize,Serialize};
use std::{fs,path::{Path,PathBuf},process::Command,time::{SystemTime,UNIX_EPOCH}};
use std::env;
use tauri::Manager;
use std::{collections::HashMap,sync::Mutex};
#[derive(Serialize,Clone)] struct OpenRequest{paths:Vec<String>,autoplay:bool}
#[derive(Default)] struct FileInbox(Mutex<HashMap<String,Vec<OpenRequest>>>);
#[tauri::command] fn get_open_mode()->String{fs::read_to_string(app_root().join("open-mode.txt")).ok().filter(|s|s=="new").unwrap_or_else(||"existing".into())}
#[tauri::command] fn set_open_mode(mode:String)->Result<(),String>{if mode!="new"&&mode!="existing"{return Err("Invalid mode".into())}fs::create_dir_all(app_root()).map_err(|e|e.to_string())?;fs::write(app_root().join("open-mode.txt"),mode).map_err(|e|e.to_string())}
#[tauri::command] fn take_open_requests(window:tauri::WebviewWindow,inbox:tauri::State<FileInbox>)->Vec<OpenRequest>{inbox.0.lock().unwrap().remove(window.label()).unwrap_or_default()}
fn media_args(args:impl Iterator<Item=String>,cwd:&Path)->Vec<String>{args.map(PathBuf::from).map(|p|if p.is_absolute(){p}else{cwd.join(p)}).filter(|p|p.is_file()&&p.extension().and_then(|e|e.to_str()).map(|e|matches!(e.to_ascii_lowercase().as_str(),"m4a"|"mp3"|"wav"|"mp4"|"webm")).unwrap_or(false)).map(|p|p.to_string_lossy().into_owned()).collect()}


fn background_command(program: impl AsRef<std::ffi::OsStr>)->Command{
    let mut command=Command::new(program);
    #[cfg(target_os="windows")]
    {
        use std::os::windows::process::CommandExt;
        // FFmpeg and FFprobe are console applications. Prevent Windows from
        // allocating a terminal when they are started by the GUI application.
        const CREATE_NO_WINDOW:u32=0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

#[derive(Serialize)] struct MediaInfo { name:String, format:String, path:String, size:u64 }
#[derive(Serialize,Deserialize,Clone)] #[serde(default)] struct SlideSettings { interval:f64,duration:f64,effect:String,fit:String,layout:String }
impl Default for SlideSettings{fn default()->Self{Self{interval:2.0,duration:0.8,effect:"fade".into(),fit:"contain".into(),layout:"bars-left".into()}}}
#[derive(Serialize,Deserialize,Clone)] struct Track { id:String,path:String,name:String,format:String,srt_path:Option<String>,cover_path:Option<String>,#[serde(default)] cover_paths:Vec<String>,#[serde(default)] slideshow:Option<SlideSettings>,#[serde(default)] eq_settings:Option<serde_json::Value>,library:bool }
#[derive(Serialize,Deserialize)] struct PlaylistProject { version:u32, tracks:Vec<Track>,#[serde(default,skip_serializing_if="HashMap::is_empty")] images:HashMap<String,portable_project::EmbeddedImage> }
#[derive(Deserialize)] #[serde(untagged)] enum PlaylistProjectFile { Project(PlaylistProject), Legacy(Vec<Track>) }
fn app_root()->PathBuf{dirs::data_dir().unwrap_or_else(||PathBuf::from(".")).join("JJaIMsae Player")}
fn cfg()->PathBuf{app_root().join("playlist.json")}
fn pending()->PathBuf{app_root().join("handoff").join("pending.json")}

#[tauri::command] fn pick_media_files()->Vec<String>{rfd::FileDialog::new().add_filter("Media", &["m4a","mp3","wav","mp4","webm"]).pick_files().unwrap_or_default().iter().map(|p|p.to_string_lossy().to_string()).collect()}
fn collect_media_files(folder:&Path,files:&mut Vec<PathBuf>){
    let Ok(entries)=fs::read_dir(folder) else { return };
    for entry in entries.flatten(){
        let Ok(file_type)=entry.file_type() else { continue };
        let path=entry.path();
        if file_type.is_dir(){
            collect_media_files(&path,files);
        }else if file_type.is_file(){
            let supported=path.extension()
                .and_then(|value|value.to_str())
                .map(|value|matches!(value.to_ascii_lowercase().as_str(),"m4a"|"mp3"|"wav"|"mp4"|"webm"))
                .unwrap_or(false);
            if supported{files.push(path)}
        }
    }
}
#[tauri::command] fn pick_media_folder()->Vec<String>{
    let Some(folder)=rfd::FileDialog::new().pick_folder() else { return Vec::new() };
    let mut files=Vec::new();
    collect_media_files(&folder,&mut files);
    files.sort_by_key(|path|path.to_string_lossy().to_lowercase());
    files.into_iter().map(|path|path.to_string_lossy().to_string()).collect()
}
#[tauri::command] async fn save_srt_edit(path:Option<String>,name:String,content:String,copy:bool)->Result<Option<String>,String>{
 tauri::async_runtime::spawn_blocking(move||{
  let destination=if !copy {path.map(PathBuf::from)}else{None};
  let destination=match destination {Some(p)=>p,None=>{let stem=Path::new(&name).file_stem().unwrap_or_default().to_string_lossy();let Some(p)=rfd::FileDialog::new().add_filter("SRT",&["srt"]).set_file_name(format!("{stem}.srt")).save_file()else{return Ok(None)};p}};
  if !destination.extension().is_some_and(|ext|ext.eq_ignore_ascii_case("srt")){return Err("SRT 파일만 저장할 수 있습니다.".into())}
  fs::write(&destination,content.as_bytes()).map_err(|e|e.to_string())?;
  Ok(Some(destination.to_string_lossy().into_owned()))
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command] fn pick_srt_file()->Option<String>{rfd::FileDialog::new().add_filter("SRT", &["srt"]).pick_file().map(|p|p.to_string_lossy().to_string())}
fn cover_edit_dir(track_id:&str)->Result<PathBuf,String>{
    if track_id.is_empty() || track_id.len()>100 || !track_id.chars().all(|c|c.is_ascii_alphanumeric() || c=='-') {return Err("Invalid track ID".into())}
    Ok(app_root().join("covers").join(track_id))
}
fn clean_artwork_name(name:&str)->String {
    let clean:String=name.chars().take(120).map(|c|if c.is_control() || "\\/:*?\"<>|".contains(c){'_'}else{c}).collect();
    if clean.trim().is_empty(){"artwork".into()}else{clean}
}
fn validate_artwork_bytes(bytes:&[u8],format:&str)->Result<(),String>{
    if bytes.len()>100*1024*1024{return Err("Image is too large (100 MB limit)".into())}
    let valid=match format {
        "png"|"gif"=>bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "jpg"|"jpeg"=>bytes.starts_with(b"\xff\xd8\xff"),
        "webp"=>bytes.starts_with(b"RIFF") && bytes.get(8..12)==Some(b"WEBP"),
        "svg"=>std::str::from_utf8(bytes).map(|s|s.starts_with("<svg ") && s.ends_with("</svg>")).unwrap_or(false),
        _=>false
    };
    if valid{Ok(())}else{Err("Unsupported image format or invalid image bytes".into())}
}
fn encode_artwork_gif(bytes:Vec<u8>)->Result<Vec<u8>,String>{
    use std::io::Write;
    use std::process::Stdio;
    let tool=bundled_tool("ffmpeg")?;
    let mut child=background_command(tool).args(["-hide_banner","-loglevel","error","-f","image2pipe","-i","pipe:0","-filter_complex","[0:v]split[a][b];[a]palettegen=stats_mode=single[p];[b][p]paletteuse=dither=sierra2_4a","-frames:v","1","-f","gif","pipe:1"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(|e|e.to_string())?;
    let mut input=child.stdin.take().ok_or("Cannot open GIF encoder input")?;
    let writer=std::thread::spawn(move||input.write_all(&bytes));
    let output=child.wait_with_output().map_err(|e|e.to_string())?;
    let write_result=writer.join().map_err(|_|"GIF input thread failed")?;
    if !output.status.success(){return Err(format!("GIF encoding failed: {}",String::from_utf8_lossy(&output.stderr)))}
    write_result.map_err(|e|e.to_string())?;
    if !output.stdout.starts_with(b"GIF8"){return Err("Invalid GIF encoder output".into())}
    Ok(output.stdout)
}
#[tauri::command] async fn export_cover_image(name:String,bytes:Vec<u8>,format:Option<String>)->Result<Option<String>,String>{
    let format=format.unwrap_or_else(||"png".into()).to_ascii_lowercase();
    validate_artwork_bytes(&bytes,&format)?;
    tauri::async_runtime::spawn_blocking(move||{
        let Some(path)=rfd::FileDialog::new().add_filter(format.to_uppercase(),&[format.as_str()]).set_file_name(format!("{}-cover.{}",clean_artwork_name(&name),format)).save_file() else {return Ok(None)};
        let path=path.with_extension(&format);
        let output=if format=="gif"{encode_artwork_gif(bytes)?}else{bytes};
        fs::write(&path,output).map_err(|e|e.to_string())?;
        Ok(Some(path.to_string_lossy().to_string()))
    }).await.map_err(|e|e.to_string())?
}
fn validate_image_project(project:&serde_json::Value)->Result<(),String>{
    if project.get("kind").and_then(|v|v.as_str())!=Some("jjaimsae-artwork") || project.get("version").and_then(|v|v.as_u64())!=Some(2) || !project.get("layers").map(|v|v.is_array()).unwrap_or(false) || !project.get("sourceData").and_then(|v|v.as_str()).map(|v|v.starts_with("data:image/") && v.len()<=110*1024*1024).unwrap_or(false){return Err("Invalid artwork project".into())}
    Ok(())
}
#[tauri::command] fn save_image_project(name:String,project:serde_json::Value)->Result<Option<String>,String>{
    validate_image_project(&project)?;
    if serde_json::to_vec(&project).map_err(|e|e.to_string())?.len()>115*1024*1024{return Err("Project is too large (115 MB limit)".into())}
    let Some(path)=rfd::FileDialog::new().add_filter("JJaIMsae Image Project",&["jjimg"]).set_file_name(format!("{}.jjimg",clean_artwork_name(&name))).save_file() else {return Ok(None)};
    let path=path.with_extension("jjimg");
    fs::write(&path,serde_json::to_vec(&project).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
}
#[tauri::command] fn open_image_project()->Result<Option<serde_json::Value>,String>{
    let Some(path)=rfd::FileDialog::new().add_filter("JJaIMsae Image Project",&["jjimg"]).pick_file() else {return Ok(None)};
    if fs::metadata(&path).map_err(|e|e.to_string())?.len()>115*1024*1024{return Err("Project is too large".into())}
    let project:serde_json::Value=serde_json::from_slice(&fs::read(&path).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    validate_image_project(&project)?;
    Ok(Some(project))
}
#[tauri::command] fn load_cover_edit(track_id:String)->Result<Option<serde_json::Value>,String>{
    let path=cover_edit_dir(&track_id)?.join("edit.json");
    if !path.exists(){return Ok(None)}
    serde_json::from_slice(&fs::read(path).map_err(|e|e.to_string())?).map(Some).map_err(|e|e.to_string())
}
#[tauri::command] fn save_cover_edit(track_id:String,bytes:Vec<u8>,source_bytes:Option<Vec<u8>>,mut project:serde_json::Value)->Result<String,String>{
    if bytes.len()>80*1024*1024 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n"){return Err("Invalid PNG image".into())}
    if serde_json::to_vec(&project).map_err(|e|e.to_string())?.len()>115*1024*1024{return Err("Project is too large (115 MB limit)".into())}
    let dir=cover_edit_dir(&track_id)?;fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let original=if let Some(source)=source_bytes{
        if source.len()>100*1024*1024{return Err("Source image is too large".into())}
        let extension=if source.starts_with(b"\x89PNG\r\n\x1a\n"){"png"}else if source.starts_with(b"\xff\xd8\xff"){"jpg"}else if source.starts_with(b"RIFF") && source.get(8..12)==Some(b"WEBP"){"webp"}else if source.starts_with(b"GIF8"){"gif"}else{return Err("Invalid source image".into())};
        let path=dir.join(format!("source_{stamp}.{extension}"));
        fs::write(&path,source).map_err(|e|e.to_string())?;path
    }else{
        let source=project.get("sourcePath").and_then(|v|v.as_str()).ok_or("Missing source image")?;
        let source_path=Path::new(source);
        let extension=source_path.extension().and_then(|v|v.to_str()).unwrap_or("png").to_ascii_lowercase();
        if !["png","jpg","jpeg","webp","gif"].contains(&extension.as_str()){return Err("Unsupported source image".into())}
        let path=dir.join(format!("source_{stamp}.{extension}"));
        fs::copy(source_path,&path).map_err(|e|e.to_string())?;path
    };
    project["sourcePath"]=serde_json::Value::String(original.to_string_lossy().to_string());
    let output=dir.join(format!("cover_{stamp}.png"));
    fs::write(&output,bytes).map_err(|e|e.to_string())?;
    project["outputPath"]=serde_json::Value::String(output.to_string_lossy().to_string());
    let temp=dir.join(format!("edit_{stamp}.tmp"));
    fs::write(&temp,serde_json::to_vec_pretty(&project).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    fs::write(output.with_extension("jjimg"),serde_json::to_vec(&project).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    fs::rename(temp,dir.join("edit.json")).map_err(|e|e.to_string())?;
    Ok(output.to_string_lossy().to_string())
}
#[tauri::command] fn load_cover_version(path:String)->Result<Option<serde_json::Value>,String>{
    let project=Path::new(&path).with_extension("jjimg");if !project.exists(){return Ok(None)}
    if fs::metadata(&project).map_err(|e|e.to_string())?.len()>115*1024*1024{return Err("Project is too large".into())}
    serde_json::from_slice(&fs::read(project).map_err(|e|e.to_string())?).map(Some).map_err(|e|e.to_string())
}
#[tauri::command] fn pick_cover_files()->Vec<String>{rfd::FileDialog::new().add_filter("Images and videos",&["png","jpg","jpeg","webp","gif","webm","mp4"]).pick_files().unwrap_or_default().into_iter().map(|path|path.to_string_lossy().into_owned()).collect()}
#[tauri::command] async fn import_track_images(track_id:String,paths:Vec<String>)->Result<Vec<String>,String>{
 let dir=cover_edit_dir(&track_id)?;
 if paths.len()>100{return Err("한 번에 최대 100장까지 추가할 수 있습니다.".into())}
 tauri::async_runtime::spawn_blocking(move||{
  let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();let folder=dir.join(format!("images_{stamp}"));let mut prepared=vec![];
  for path in &paths{let source=PathBuf::from(path);if !source.is_file()||fs::metadata(&source).map_err(|_|"이미지 파일에 접근할 수 없습니다.")?.len()>80*1024*1024{return Err("이미지가 없거나 80MB를 초과했습니다.".into())}let ext=source.extension().and_then(|s|s.to_str()).unwrap_or("").to_ascii_lowercase();if !["png","jpg","jpeg","webp","gif","webm","mp4"].contains(&ext.as_str()){return Err("PNG/JPG/WebP/GIF 이미지와 WebM/MP4 동영상을 추가할 수 있습니다.".into())}prepared.push((source,ext));}
  fs::create_dir_all(&folder).map_err(|_|"곡 이미지 폴더를 만들 수 없습니다.")?;let mut result=vec![];
  for (index,(source,ext)) in prepared.into_iter().enumerate(){let destination=folder.join(format!("image_{stamp}_{}.{}",index+1,ext));fs::copy(source,&destination).map_err(|_|"이미지를 보관하지 못했습니다.")?;result.push(destination.to_string_lossy().into_owned())}Ok(result)
 }).await.map_err(|_|"이미지 가져오기 작업 오류")?
}
#[tauri::command] fn pick_cover_file()->Option<String>{rfd::FileDialog::new().add_filter("Image", &["png","jpg","jpeg","webp","gif"]).pick_file().map(|p|p.to_string_lossy().to_string())}
#[tauri::command] fn reveal_media_file(path:String)->Result<(),String>{
    let path=PathBuf::from(path).canonicalize().map_err(|_|"파일이 없거나 파일 경로에 접근할 수 없습니다.")?;
    if !path.is_file(){return Err("곡 파일을 찾을 수 없습니다.".into())}
    #[cfg(windows)] {
        let path=path.to_string_lossy();
        let visible=if let Some(unc)=path.strip_prefix(r"\\?\UNC\"){format!(r"\\{unc}")}else{path.strip_prefix(r"\\?\").unwrap_or(&path).to_string()};
        let explorer=PathBuf::from(env::var_os("SystemRoot").unwrap_or_else(||r"C:\Windows".into())).join("explorer.exe");
        background_command(explorer).arg("/select,").arg(visible).spawn().map_err(|_|"Windows 탐색기를 열지 못했습니다.")?;
        Ok(())
    }
    #[cfg(not(windows))] {Err("파일 위치 열기는 Windows에서 지원합니다.".into())}
}
#[tauri::command] fn media_info(path:String)->Result<MediaInfo,String>{let p=PathBuf::from(&path);let m=fs::metadata(&p).map_err(|e|e.to_string())?;Ok(MediaInfo{name:p.file_name().unwrap_or_default().to_string_lossy().to_string(),format:p.extension().unwrap_or_default().to_string_lossy().to_uppercase(),path,size:m.len()})}
#[tauri::command] fn read_text(path:String)->Result<String,String>{fs::read_to_string(path).map_err(|e|e.to_string())}
#[tauri::command] fn save_playlist(tracks:Vec<Track>)->Result<String,String>{fs::create_dir_all(app_root()).map_err(|e|e.to_string())?;fs::write(cfg(),serde_json::to_vec_pretty(&tracks).unwrap()).map_err(|e|e.to_string())?;Ok(cfg().to_string_lossy().to_string())}
#[tauri::command] fn load_playlist()->Vec<Track>{fs::read(cfg()).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default()}
#[tauri::command] async fn save_playlist_project(tracks:Vec<Track>)->Result<Option<String>,String>{
 tauri::async_runtime::spawn_blocking(move||{let Some(path)=rfd::FileDialog::new().add_filter("JJaIMsae Playlist Project",&["jjp"]).add_filter("JSON",&["json"]).set_file_name("JJaIMsae-playlist.jjp").save_file()else{return Ok(None)};let project=portable_project::pack(tracks)?;portable_project::write(&path,&project)?;Ok(Some(path.to_string_lossy().into_owned()))}).await.map_err(|e|e.to_string())?
}
#[tauri::command] async fn open_playlist_project()->Result<Option<Vec<Track>>,String>{
 tauri::async_runtime::spawn_blocking(||{let Some(path)=rfd::FileDialog::new().add_filter("JJaIMsae Playlist Project",&["jjp","json"]).pick_file()else{return Ok(None)};let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();let root=app_root().join("projects").join(format!("images_{stamp}"));portable_project::open(&path,&root).map(Some)}).await.map_err(|e|e.to_string())?
}
#[tauri::command] fn copy_to_library(track:Track)->Result<Track,String>{let dir=app_root().join("library").join(&track.id);fs::create_dir_all(&dir).map_err(|e|e.to_string())?;let src=PathBuf::from(&track.path);let dst=dir.join(src.file_name().unwrap());fs::copy(&src,&dst).map_err(|e|e.to_string())?;let mut t=track;t.path=dst.to_string_lossy().to_string();t.library=true;if let Some(s)=&t.srt_path{let p=PathBuf::from(s);let d=dir.join(p.file_name().unwrap());fs::copy(p,&d).map_err(|e|e.to_string())?;t.srt_path=Some(d.to_string_lossy().to_string())}if let Some(c)=&t.cover_path{let p=PathBuf::from(c);let d=dir.join(p.file_name().unwrap());fs::copy(p,&d).map_err(|e|e.to_string())?;t.cover_path=Some(d.to_string_lossy().to_string())}for cover in &mut t.cover_paths{let source=PathBuf::from(&*cover);let destination=dir.join(source.file_name().ok_or("Invalid cover path")?);if source!=destination{fs::copy(&source,&destination).map_err(|e|e.to_string())?;let project=source.with_extension("jjimg");if project.exists(){fs::copy(project,destination.with_extension("jjimg")).map_err(|e|e.to_string())?;}}*cover=destination.to_string_lossy().to_string();}fs::write(dir.join("metadata.json"),serde_json::to_vec_pretty(&t).unwrap()).map_err(|e|e.to_string())?;Ok(t)}
fn bundled_tool(name:&str)->Result<PathBuf,String>{
    let exe=env::current_exe().map_err(|e|e.to_string())?;
    let dir=exe.parent().ok_or("실행 파일 폴더를 확인할 수 없습니다.")?;
    let candidates=[dir.join(format!("{}.exe",name)),dir.join("bin").join(format!("{}.exe",name)),dir.join("resources").join("bin").join(format!("{}.exe",name))];
    for p in candidates { if p.exists(){return Ok(p)} }
    Err(format!("내장 {}.exe를 찾을 수 없습니다. src-tauri/bin/{}.exe를 넣고 다시 빌드하세요.",name,name))
}
#[tauri::command] fn ffmpeg_status()->String{
    match (bundled_tool("ffmpeg"),bundled_tool("ffprobe")) {
      (Ok(f),Ok(p))=>format!("내장 FFmpeg/FFprobe 사용 가능 · {} · {}",f.display(),p.display()),
      (Err(e),_)|(_,Err(e))=>e
    }
}
#[tauri::command] fn probe_media(path:String)->Result<String,String>{
    let tool=bundled_tool("ffprobe")?;
    let o=background_command(tool).args(["-v","quiet","-print_format","json","-show_format","-show_streams",&path]).output().map_err(|e|e.to_string())?;
    if !o.status.success(){return Err(String::from_utf8_lossy(&o.stderr).to_string())}
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}
#[tauri::command] async fn analyze_file_volume(path:String)->Result<serde_json::Value,String>{
    tauri::async_runtime::spawn_blocking(move || {
        let tool=bundled_tool("ffmpeg")?;
        let output=background_command(tool).args(["-hide_banner","-nostdin","-i",&path,"-map","0:a:0","-vn","-af","volumedetect","-f","null","-"]).output().map_err(|e|e.to_string())?;
        let log=String::from_utf8_lossy(&output.stderr);
        if !output.status.success(){return Err(log.to_string())}
        let value=|key:&str|->Result<String,String>{log.lines().find_map(|line|line.split_once(key).map(|(_,v)|v.trim().to_string())).ok_or_else(||"음량 분석 결과가 없습니다.".into())};
        Ok(serde_json::json!({"peak":value("max_volume:")?,"mean":value("mean_volume:")?}))
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command] fn audio_fingerprint(path:String)->Result<String,String>{
    let tool=bundled_tool("ffmpeg")?;
    let o=background_command(tool)
        .args(["-v","error","-i",&path,"-map","0:a:0","-vn","-f","hash","-hash","sha256","-"])
        .output()
        .map_err(|e|e.to_string())?;
    if !o.status.success(){return Err(String::from_utf8_lossy(&o.stderr).trim().to_string())}
    let hash=String::from_utf8_lossy(&o.stdout).trim().to_string();
    hash.split_once('=').map(|(_,value)|value.trim().to_string()).filter(|value|!value.is_empty()).ok_or_else(||"오디오 지문을 생성하지 못했습니다.".into())
}
#[tauri::command] fn convert_audio(path:String,format:String,profile:Option<String>)->Result<String,String>{
    let src=PathBuf::from(&path);
    if !src.exists(){return Err("원본 파일을 찾을 수 없습니다.".into())}
    let selected=profile.unwrap_or_else(||if format=="mp3"{"mp3_hq".into()}else{"wav24_48k".into()});
    let (suffix,extension)=match selected.as_str(){
        "mp3_hq"=>("_HQ_320k","mp3"),
        "wav16_48k"=>("_16bit_48k","wav"),
        "wav24_48k"=>("_24bit_48k","wav"),
        _=>return Err("지원하지 않는 변환 프로필입니다.".into())
    };
    let parent=src.parent().unwrap_or_else(||Path::new("."));
    let stem=src.file_stem().unwrap_or_default().to_string_lossy();
    let mut out=parent.join(format!("{stem}{suffix}.{extension}"));
    if out.exists(){
        let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
        out=parent.join(format!("{stem}{suffix}_{stamp}.{extension}"));
    }
    let tool=bundled_tool("ffmpeg")?;
    let mut c=background_command(tool);
    c.args(["-y","-i",&path,"-map","0:a:0","-vn","-ar","48000"]);
    match selected.as_str(){
        "mp3_hq"=>{c.args(["-codec:a","libmp3lame","-b:a","320k"]);},
        "wav16_48k"=>{c.args(["-codec:a","pcm_s16le"]);},
        _=>{c.args(["-codec:a","pcm_s24le"]);}
    }
    c.arg(&out);
    let o=c.output().map_err(|e|e.to_string())?;
    if !o.status.success(){let _=fs::remove_file(&out);return Err(String::from_utf8_lossy(&o.stderr).to_string())}
    Ok(out.to_string_lossy().to_string())
}
#[tauri::command]
fn close_acoustics_window(window:tauri::WebviewWindow)->Result<(),String>{
    if !window.label().starts_with("analysis-") {return Err("Not an analysis window".into());}
    window.close().map_err(|e|e.to_string())
}
#[tauri::command]
// Windows WebView2 window creation must run outside synchronous command dispatch.
async fn open_acoustics_window(app:tauri::AppHandle,token:String)->Result<(),String>{
    if token.len()!=36 || !token.chars().all(|c|c.is_ascii_hexdigit()||c=='-') {return Err("Invalid analysis token".into());}
    let url="analysis-window.html";
    tauri::WebviewWindowBuilder::new(&app,format!("analysis-{token}"),tauri::WebviewUrl::App(url.into()))
        .title("JJaIMsae · 시간별 음향 분석").inner_size(1250.0,850.0).min_inner_size(800.0,600.0)
        .build().map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command] fn save_analysis_csv(suggested_name:String,content:String)->Result<Option<String>,String>{
    let Some(path)=rfd::FileDialog::new()
        .add_filter("CSV", &["csv"])
        .set_file_name(&suggested_name)
        .save_file() else { return Ok(None) };
    fs::write(&path,content.as_bytes()).map_err(|e|e.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
}
#[tauri::command] fn apply_audio_fades(path:String,fade_in:f64,fade_out:f64,duration:f64,overwrite:bool)->Result<String,String>{
    if fade_in<=0.0 && fade_out<=0.0{return Err("Fade In 또는 Fade Out을 하나 이상 선택하세요.".into())}
    let src=PathBuf::from(&path);
    if !src.exists(){return Err("원본 파일을 찾을 수 없습니다.".into())}
    let parent=src.parent().unwrap_or_else(||Path::new("."));
    let stem=src.file_stem().unwrap_or_default().to_string_lossy();
    let ext=src.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let mut out=if overwrite{parent.join(format!(".{stem}.fade-{stamp}.{ext}"))}else{parent.join(format!("{stem}_fade.{ext}"))};
    if !overwrite && out.exists(){out=parent.join(format!("{stem}_fade_{stamp}.{ext}"));}
    let mut filters=Vec::new();
    if fade_in>0.0{filters.push(format!("afade=t=in:st=0:d={:.3}",fade_in.min(duration.max(0.1))))}
    if fade_out>0.0{let len=fade_out.min(duration.max(0.1));filters.push(format!("afade=t=out:st={:.3}:d={:.3}",(duration-len).max(0.0),len))}
    let tool=bundled_tool("ffmpeg")?;
    let mut c=background_command(tool);
    c.args(["-y","-i",&path,"-map","0:v?","-map","0:a:0","-af",&filters.join(","),"-c:v","copy"]);
    match ext.as_str(){"mp3"=>{c.args(["-c:a","libmp3lame","-b:a","320k"]);},"wav"=>{c.args(["-c:a","pcm_s24le"]);},"webm"=>{c.args(["-c:a","libopus"]);},_=>{c.args(["-c:a","aac","-b:a","320k"]);}}
    c.arg(&out);
    let result=c.output().map_err(|e|e.to_string())?;
    if !result.status.success(){let _=fs::remove_file(&out);return Err(String::from_utf8_lossy(&result.stderr).to_string())}
    if overwrite{
        let backup=parent.join(format!(".{stem}.backup-{stamp}.{ext}"));
        fs::rename(&src,&backup).map_err(|e|format!("원본 백업 생성 실패: {e}"))?;
        if let Err(error)=fs::rename(&out,&src){let _=fs::rename(&backup,&src);let _=fs::remove_file(&out);return Err(format!("원본 교체 실패: {error}"))}
        let _=fs::remove_file(backup);
        Ok(src.to_string_lossy().to_string())
    }else{Ok(out.to_string_lossy().to_string())}
}
fn editable_audio_extension(src:&Path)->String{
    let ext=src.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    if ["mp3","wav","m4a","mp4","webm","aac","ogg","opus"].contains(&ext.as_str()){ext}else{"m4a".into()}
}
fn unique_edit_path(src:&Path,suffix:&str,extension:&str)->PathBuf{
    let parent=src.parent().unwrap_or_else(||Path::new("."));
    let stem=src.file_stem().unwrap_or_default().to_string_lossy();
    let preferred=parent.join(format!("{stem}{suffix}.{extension}"));
    if !preferred.exists(){return preferred}
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    parent.join(format!("{stem}{suffix}_{stamp}.{extension}"))
}
fn configure_audio_encoder(command:&mut Command,extension:&str){
    match extension{
        "mp3"=>{command.args(["-c:a","libmp3lame","-b:a","320k"]);},
        "wav"=>{command.args(["-c:a","pcm_s24le"]);},
        "webm"|"opus"=>{command.args(["-c:a","libopus","-b:a","256k"]);},
        "ogg"=>{command.args(["-c:a","libvorbis","-q:a","8"]);},
        _=>{command.args(["-c:a","aac","-b:a","320k"]);}
    }
}
fn render_audio_edit(path:&str,out:&Path,start:f64,end:f64,fade_in:f64,fade_out:f64)->Result<(),String>{
    let length=end-start;
    if !start.is_finite()||!end.is_finite()||start<0.0||length<0.05{return Err("편집 구간이 올바르지 않습니다.".into())}
    let extension=editable_audio_extension(out);
    let mut filters=Vec::new();
    let fade_in=fade_in.max(0.0).min(length);
    let fade_out=fade_out.max(0.0).min(length);
    if fade_in>0.0{filters.push(format!("afade=t=in:st=0:d={fade_in:.3}"));}
    if fade_out>0.0{filters.push(format!("afade=t=out:st={:.3}:d={fade_out:.3}",(length-fade_out).max(0.0)));}
    let tool=bundled_tool("ffmpeg")?;
    let mut command=background_command(tool);
    command.args(["-y","-ss",&format!("{start:.6}"),"-i",path,"-t",&format!("{length:.6}"),"-map","0:a:0","-vn"]);
    if !filters.is_empty(){command.args(["-af",&filters.join(",")]);}
    configure_audio_encoder(&mut command,&extension);
    command.arg(out);
    let result=command.output().map_err(|e|e.to_string())?;
    if !result.status.success(){let _=fs::remove_file(out);return Err(String::from_utf8_lossy(&result.stderr).to_string())}
    Ok(())
}
#[tauri::command] fn apply_audio_edit(path:String,trim_start:f64,trim_end:f64,fade_in:f64,fade_out:f64,overwrite:bool)->Result<String,String>{
    let src=PathBuf::from(&path);
    if !src.exists(){return Err("원본 파일을 찾을 수 없습니다.".into())}
    let extension=editable_audio_extension(&src);
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let out=if overwrite{
        src.parent().unwrap_or_else(||Path::new(".")).join(format!(".{}.edit-{stamp}.{extension}",src.file_stem().unwrap_or_default().to_string_lossy()))
    }else{unique_edit_path(&src,"_edit",&extension)};
    render_audio_edit(&path,&out,trim_start,trim_end,fade_in,fade_out)?;
    if overwrite{
        let backup=src.parent().unwrap_or_else(||Path::new(".")).join(format!(".{}.backup-{stamp}.{extension}",src.file_stem().unwrap_or_default().to_string_lossy()));
        fs::rename(&src,&backup).map_err(|e|format!("원본 백업 생성 실패: {e}"))?;
        if let Err(error)=fs::rename(&out,&src){let _=fs::rename(&backup,&src);let _=fs::remove_file(&out);return Err(format!("원본 교체 실패: {error}"))}
        let _=fs::remove_file(backup);
        Ok(src.to_string_lossy().to_string())
    }else{Ok(out.to_string_lossy().to_string())}
}
#[tauri::command] fn split_audio_clip(path:String,range_start:f64,cut_at:f64,range_end:f64)->Result<Vec<String>,String>{
    let src=PathBuf::from(&path);
    if !src.exists(){return Err("원본 파일을 찾을 수 없습니다.".into())}
    if !range_start.is_finite()||!cut_at.is_finite()||!range_end.is_finite()||cut_at-range_start<0.05||range_end-cut_at<0.05{
        return Err("재생 헤드를 편집 구간 안쪽에 놓으세요.".into())
    }
    let extension=editable_audio_extension(&src);
    let left=unique_edit_path(&src,"_part_1",&extension);
    let right=unique_edit_path(&src,"_part_2",&extension);
    render_audio_edit(&path,&left,range_start,cut_at,0.0,0.0)?;
    if let Err(error)=render_audio_edit(&path,&right,cut_at,range_end,0.0,0.0){let _=fs::remove_file(&left);return Err(error)}
    Ok(vec![left.to_string_lossy().to_string(),right.to_string_lossy().to_string()])
}
#[tauri::command] fn prepare_mastering(track:Track)->Result<(),String>{let p=pending();fs::create_dir_all(p.parent().unwrap()).map_err(|e|e.to_string())?;fs::write(p,serde_json::to_vec(&track).unwrap()).map_err(|e|e.to_string())}
// Keep the handoff until the mastering page confirms that the audio decoded.
// Removing it while merely reading it loses the track if WebView2 is still
// starting or the first asset-protocol request fails.
#[tauri::command] fn peek_pending_mastering()->Option<Track>{
    fs::read(pending()).ok().and_then(|b|serde_json::from_slice(&b).ok())
}
#[tauri::command] fn clear_pending_mastering()->Result<(),String>{
    let path=pending();
    if path.exists(){fs::remove_file(path).map_err(|e|e.to_string())?;}
    Ok(())
}
#[tauri::command] fn read_binary(path:String)->Result<Vec<u8>,String>{fs::read(path).map_err(|e|e.to_string())}
#[tauri::command] fn save_mastered_bytes(name:String,bytes:Vec<u8>)->Result<String,String>{let dir=app_root().join("mastered");fs::create_dir_all(&dir).map_err(|e|e.to_string())?;let original=Path::new(&name).file_name().unwrap_or_default();let mut p=dir.join(original);if p.exists(){let stem=Path::new(original).file_stem().unwrap_or_default().to_string_lossy();let ext=Path::new(original).extension().unwrap_or_default().to_string_lossy();let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();p=dir.join(if ext.is_empty(){format!("{stem}_{stamp}")}else{format!("{stem}_{stamp}.{ext}")})}fs::write(&p,bytes).map_err(|e|e.to_string())?;Ok(p.to_string_lossy().to_string())}
#[tauri::command] fn startup_media_files(window:tauri::WebviewWindow)->Vec<String>{if window.label()!="main"{return vec![]}media_args(env::args().skip(1),&env::current_dir().unwrap_or_default())}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(){tauri::Builder::default()
.plugin(tauri_plugin_single_instance::init(|app,args,cwd|{
 let paths=media_args(args.into_iter().skip(1),Path::new(&cwd));
 let separate=!paths.is_empty()&&get_open_mode()=="new";
 let label=if separate{format!("player-{}",SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos())}else if app.get_webview_window("main").is_some(){"main".into()}else{app.webview_windows().keys().min().cloned().unwrap_or_else(||"main".into())};
 if !paths.is_empty(){app.state::<FileInbox>().0.lock().unwrap().entry(label.clone()).or_default().push(OpenRequest{paths,autoplay:true});}
 if separate{
  // Build off the Windows event thread to avoid a WebView2 creation deadlock.
  let handle=app.clone();std::thread::spawn(move||{
   if let Err(error)=tauri::WebviewWindowBuilder::new(&handle,&label,tauri::WebviewUrl::App("index.html?isolated=1".into())).title("JJaIMsae Player").inner_size(1500.0,960.0).min_inner_size(980.0,680.0).build(){handle.state::<FileInbox>().0.lock().unwrap().remove(&label);rfd::MessageDialog::new().set_title("새 창 열기 실패").set_description(error.to_string()).show();}
  });
 }
 else if let Some(w)=app.get_webview_window(&label){let _=w.unminimize();let _=w.show();let _=w.set_focus();}
}))
.manage(FileInbox::default()).manage(ai_image::AiState::default())
.on_window_event(|w,e|{if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop{paths,..})=e{w.state::<FileInbox>().0.lock().unwrap().entry(w.label().into()).or_default().push(OpenRequest{paths:paths.iter().map(|p|p.to_string_lossy().into_owned()).collect(),autoplay:false});}if matches!(e,tauri::WindowEvent::Destroyed){w.state::<FileInbox>().0.lock().unwrap().remove(w.label());}})
.invoke_handler(tauri::generate_handler![ai_image::open_ai_key_page,ai_image::get_ai_settings,ai_image::save_ai_settings,ai_image::delete_ai_key,ai_image::list_ai_images,ai_image::ai_generate_image,get_open_mode,set_open_mode,take_open_requests,pick_media_files,pick_media_folder,pick_srt_file,save_srt_edit,pick_cover_file,pick_cover_files,import_track_images,load_cover_edit,save_cover_edit,export_cover_image,save_image_project,open_image_project,load_cover_version,reveal_media_file,media_info,read_text,save_playlist,load_playlist,save_playlist_project,open_playlist_project,copy_to_library,ffmpeg_status,probe_media,analyze_file_volume,audio_fingerprint,convert_audio,close_acoustics_window,open_acoustics_window,save_analysis_csv,apply_audio_fades,apply_audio_edit,split_audio_clip,prepare_mastering,peek_pending_mastering,clear_pending_mastering,read_binary,save_mastered_bytes,startup_media_files]).run(tauri::generate_context!()).expect("run error");}

#[cfg(test)] mod song_image_tests {
 use super::*;
 #[test] fn slide_defaults_are_two_seconds_and_old_settings_keep_their_interval(){let defaults=SlideSettings::default();assert_eq!(defaults.interval,2.0);assert_eq!(defaults.layout,"bars-left");let old:SlideSettings=serde_json::from_value(serde_json::json!({"interval":7,"effect":"fade","fit":"contain"})).unwrap();assert_eq!(old.interval,7.0);assert_eq!(old.layout,"bars-left");}
 #[test] fn eq_settings_survive_track_roundtrip(){let track:Track=serde_json::from_value(serde_json::json!({"id":"eq","path":"song.wav","name":"Song","format":"WAV","library":false,"eq_settings":{"eqEnabled":true,"eq":[1.5,-2.0]}})).unwrap();let saved=serde_json::to_value(track).unwrap();assert_eq!(saved["eq_settings"]["eqEnabled"],true);assert_eq!(saved["eq_settings"]["eq"][0],1.5);}
 #[test] fn old_playlists_load_with_default_image_settings(){let track:Track=serde_json::from_value(serde_json::json!({"id":"old","path":"song.wav","name":"Song","format":"WAV","srt_path":null,"cover_path":null,"library":false})).unwrap();assert!(track.cover_paths.is_empty());assert!(track.slideshow.is_none());}
 #[test] fn song_gallery_and_effects_survive_project_roundtrip(){let project=serde_json::json!({"version":1,"tracks":[{"id":"song","path":"song.wav","name":"Song","format":"WAV","srt_path":null,"cover_path":"b.png","cover_paths":["a.png","b.png"],"slideshow":{"interval":7,"duration":1.2,"effect":"wipe","fit":"cover"},"library":false}]});let parsed:PlaylistProject=serde_json::from_value(project).unwrap();let serialized=serde_json::to_value(parsed).unwrap();assert_eq!(serialized["tracks"][0]["cover_paths"][1],"b.png");assert_eq!(serialized["tracks"][0]["slideshow"]["effect"],"wipe");assert_eq!(serialized["tracks"][0]["slideshow"]["duration"],1.2);}
}
