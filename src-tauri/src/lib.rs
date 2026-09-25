use serde::{Deserialize,Serialize};
use std::{fs,path::{Path,PathBuf},process::Command,time::{SystemTime,UNIX_EPOCH}};
use std::env;

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
#[derive(Serialize,Deserialize,Clone)] struct Track { id:String,path:String,name:String,format:String,srt_path:Option<String>,cover_path:Option<String>,library:bool }
#[derive(Serialize,Deserialize)] struct PlaylistProject { version:u32, tracks:Vec<Track> }
#[derive(Deserialize)] #[serde(untagged)] enum PlaylistProjectFile { Project(PlaylistProject), Legacy(Vec<Track>) }
fn app_root()->PathBuf{dirs::data_dir().unwrap_or_else(||PathBuf::from(".")).join("JJaIMsae Player")}
fn cfg()->PathBuf{app_root().join("playlist.json")}
fn pending()->PathBuf{app_root().join("handoff").join("pending.json")}

#[tauri::command] fn pick_media_files()->Vec<String>{rfd::FileDialog::new().add_filter("Media", &["m4a","mp3","wav","mp4","webm"]).pick_files().unwrap_or_default().iter().map(|p|p.to_string_lossy().to_string()).collect()}
#[tauri::command] fn pick_srt_file()->Option<String>{rfd::FileDialog::new().add_filter("SRT", &["srt"]).pick_file().map(|p|p.to_string_lossy().to_string())}
#[tauri::command] fn pick_cover_file()->Option<String>{rfd::FileDialog::new().add_filter("Image", &["png","jpg","jpeg","webp"]).pick_file().map(|p|p.to_string_lossy().to_string())}
#[tauri::command] fn media_info(path:String)->Result<MediaInfo,String>{let p=PathBuf::from(&path);let m=fs::metadata(&p).map_err(|e|e.to_string())?;Ok(MediaInfo{name:p.file_name().unwrap_or_default().to_string_lossy().to_string(),format:p.extension().unwrap_or_default().to_string_lossy().to_uppercase(),path,size:m.len()})}
#[tauri::command] fn read_text(path:String)->Result<String,String>{fs::read_to_string(path).map_err(|e|e.to_string())}
#[tauri::command] fn save_playlist(tracks:Vec<Track>)->Result<String,String>{fs::create_dir_all(app_root()).map_err(|e|e.to_string())?;fs::write(cfg(),serde_json::to_vec_pretty(&tracks).unwrap()).map_err(|e|e.to_string())?;Ok(cfg().to_string_lossy().to_string())}
#[tauri::command] fn load_playlist()->Vec<Track>{fs::read(cfg()).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default()}
#[tauri::command] fn save_playlist_project(tracks:Vec<Track>)->Result<Option<String>,String>{
    let Some(path)=rfd::FileDialog::new()
        .add_filter("JJaIMsae Playlist Project", &["jjp"])
        .add_filter("JSON", &["json"])
        .set_file_name("JJaIMsae-playlist.jjp")
        .save_file() else { return Ok(None) };
    let project=PlaylistProject{version:1,tracks};
    let bytes=serde_json::to_vec_pretty(&project).map_err(|e|e.to_string())?;
    fs::write(&path,bytes).map_err(|e|e.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
}
#[tauri::command] fn open_playlist_project()->Result<Option<Vec<Track>>,String>{
    let Some(path)=rfd::FileDialog::new()
        .add_filter("JJaIMsae Playlist Project", &["jjp","json"])
        .pick_file() else { return Ok(None) };
    let bytes=fs::read(&path).map_err(|e|e.to_string())?;
    let file:PlaylistProjectFile=serde_json::from_slice(&bytes).map_err(|e|format!("올바른 재생목록 프로젝트가 아닙니다: {e}"))?;
    Ok(Some(match file { PlaylistProjectFile::Project(project)=>project.tracks, PlaylistProjectFile::Legacy(tracks)=>tracks }))
}
#[tauri::command] fn copy_to_library(track:Track)->Result<Track,String>{let dir=app_root().join("library").join(&track.id);fs::create_dir_all(&dir).map_err(|e|e.to_string())?;let src=PathBuf::from(&track.path);let dst=dir.join(src.file_name().unwrap());fs::copy(&src,&dst).map_err(|e|e.to_string())?;let mut t=track;t.path=dst.to_string_lossy().to_string();t.library=true;if let Some(s)=&t.srt_path{let p=PathBuf::from(s);let d=dir.join(p.file_name().unwrap());fs::copy(p,&d).map_err(|e|e.to_string())?;t.srt_path=Some(d.to_string_lossy().to_string())}if let Some(c)=&t.cover_path{let p=PathBuf::from(c);let d=dir.join(p.file_name().unwrap());fs::copy(p,&d).map_err(|e|e.to_string())?;t.cover_path=Some(d.to_string_lossy().to_string())}fs::write(dir.join("metadata.json"),serde_json::to_vec_pretty(&t).unwrap()).map_err(|e|e.to_string())?;Ok(t)}
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
#[tauri::command] fn convert_audio(path:String,format:String)->Result<String,String>{
    let src=PathBuf::from(&path);let out=src.with_extension(&format);let tool=bundled_tool("ffmpeg")?;let mut c=background_command(tool);
    c.args(["-y","-i",&path]);if format=="mp3"{c.args(["-vn","-codec:a","libmp3lame","-b:a","320k"]);}else{c.args(["-vn","-codec:a","pcm_s24le"]);}c.arg(&out);
    let o=c.output().map_err(|e|e.to_string())?;if !o.status.success(){return Err(String::from_utf8_lossy(&o.stderr).to_string())}Ok(out.to_string_lossy().to_string())
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
#[tauri::command] fn startup_media_files()->Vec<String>{std::env::args().skip(1).filter(|s|["m4a","mp3","wav","mp4","webm"].iter().any(|e|s.to_lowercase().ends_with(e))).collect()}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(){tauri::Builder::default().invoke_handler(tauri::generate_handler![pick_media_files,pick_srt_file,pick_cover_file,media_info,read_text,save_playlist,load_playlist,save_playlist_project,open_playlist_project,copy_to_library,ffmpeg_status,probe_media,convert_audio,apply_audio_fades,prepare_mastering,peek_pending_mastering,clear_pending_mastering,read_binary,save_mastered_bytes,startup_media_files]).run(tauri::generate_context!()).expect("run error");}
