# Protected Repository Rules

These rules apply to the entire repository and must remain in force during future updates.

1. Do not modify, replace, rename, or delete `.github/workflows/release.yml`, `.github/CODEOWNERS`, this `AGENTS.md`, the build-output exclusions in `.gitignore`, or the FFmpeg resource entries in `src-tauri/tauri.conf.json` unless the repository owner explicitly requests that exact change.
2. Never commit generated Cargo/Tauri output, including `target/`, `target-*/`, installers, or compiled Rust artifacts.
3. Never commit `ffmpeg.exe`, `ffprobe.exe`, or other downloaded third-party binaries. The release workflow must obtain them during the build.
4. Preserve both release paths: manual workflow runs must upload a downloadable Actions artifact, and version tags must create or update a GitHub Release containing the Windows NSIS installer.
5. A release tag must continue to match the version in `src-tauri/tauri.conf.json`.
6. Any explicitly authorized change to protected release files must retain least-privilege permissions and must be verified with a successful GitHub Actions build before it is considered complete.

Enforcement note: `CODEOWNERS` becomes mandatory only when the `main` branch ruleset requires code-owner approval. Keep that GitHub repository setting enabled.
