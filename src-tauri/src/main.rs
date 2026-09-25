#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
#[link(name = "Kernel32")]
extern "system" {
    fn FreeConsole() -> i32;
}

#[cfg(target_os = "windows")]
fn detach_from_console() {
    // Harmless for a GUI-subsystem build, and protects development or
    // accidentally console-linked builds from being tied to a terminal.
    unsafe {
        FreeConsole();
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    detach_from_console();

    jjaimsae_player_lib::run();
}
