# JJAIMSAE MASTER Introduction

**Version 1.0.1**

JJAIMSAE MASTER is a music production and distribution support tool designed to help creators organize, master, and prepare AI-assisted or conventionally produced music for release on the JJAIMSAE platform.

It is more than a music downloader. JJAIMSAE MASTER supports the full workflow from reviewing a finished track to preparing a release-ready master, managing lyrics and subtitle files, organizing release information, and registering a track or single album on JJAIMSAE.

When working with music created in Suno, each user must authenticate with their own Suno account. Suno-related features in JJAIMSAE MASTER become available only after authentication has been completed successfully.

## 1. Main Features

JJAIMSAE MASTER provides six core capabilities:

1. Suno user authentication
2. Music and project management
3. Audio mastering
4. Lyrics and SRT subtitle management
5. M4A audio downloads
6. Track and single-album registration on JJAIMSAE

### 1.1 Suno User Authentication

To use features connected to Suno, each user must first authenticate with their own Suno account. Authentication allows JJAIMSAE MASTER to access music associated with that user's account.

Users should sign in with their individual accounts instead of sharing another person's account. After authentication is completed successfully, the Suno integration features in JJAIMSAE MASTER are activated.

**Basic workflow**

```text
Suno account -> User authentication -> JJAIMSAE MASTER features activated -> Track production workflow
```

### 1.2 Audio Mastering

JJAIMSAE MASTER includes mastering tools that help creators prepare finished mixes for listening and platform release.

Mastering is not simply the process of making a track louder. It is the final stage of audio post-production, where the overall level, tonal balance, frequency balance, and dynamics of a completed mix are refined for consistent playback and public release.

**Recommended mastering workflow**

```text
Original mix -> Audio review -> Mastering -> Result playback and review -> Final master selection -> JJAIMSAE registration
```

Automatic mastering will not produce the ideal result for every song. The outcome may vary depending on the genre, instrumentation, vocal characteristics, arrangement, and quality of the original mix. Always listen to the complete mastered track before selecting it as the final release version.

JJAIMSAE MASTER is not limited to music made with Suno. Music produced in a digital audio workstation such as Cubase, Logic Pro, or Pro Tools can also be mastered. Export the completed mix as a stereo 2-track mixdown first, then use that file as the mastering source.

### 1.3 SRT Subtitle Downloads

JJAIMSAE MASTER can generate and download files in SRT (SubRip Text) format. An SRT file stores text together with timing information and can be used to synchronize lyrics with music.

A typical SRT entry contains:

```text
Sequence number -> Start time -> End time -> Lyric or subtitle text
```

Keeping the audio file and its SRT file together makes it easier to create lyric videos, music videos, educational content, and subtitle-based media in other video-editing applications.

Starting with version 1.0.1, an SRT file can be downloaded only after the user approves the download request.

### 1.4 M4A Audio Downloads

Music can be downloaded in M4A format. M4A offers an efficient balance between audio quality and file size, making it useful for personal listening, reviewing tracks, and managing work-in-progress files.

JJAIMSAE MASTER allows up to 20 downloads per day. Users should select only the tracks required for active work instead of downloading large numbers of files at once.

For music intended for public release on JJAIMSAE, keep separate copies of both the original mix and the final mastered file. Directly managing and registering the final master provides clearer control over file versions and audio quality than relying only on downloaded copies.

## 2. Registering Music on JJAIMSAE

Completed music can be registered on JJAIMSAE as an individual track or as part of a single album. JJAIMSAE MASTER helps turn a finished audio file into an organized music release with the required audio, artwork, and metadata.

### 2.1 Individual Track Registration

Use this option to register one song as an independent track. Before registration, confirm the track title, artist information, audio file, cover image, and any other required track details.

### 2.2 Single-Album Registration

Use this option to organize one lead track or a group of related tracks as a single release project. Manage the album title, artist name, cover artwork, audio files, and release information together.

## 3. Recommended Production Workflow

The recommended end-to-end workflow is:

1. Create music in Suno or another music production application.
2. If using Suno, authenticate with your personal Suno account.
3. Review the available tracks in JJAIMSAE MASTER.
4. Select the source audio required for the project.
5. If the track was produced in Cubase, Logic Pro, Pro Tools, or another DAW, export a completed stereo 2-track mixdown.
6. Run the mastering process.
7. Listen to the mastered result and verify its quality.
8. Save the M4A and SRT files when needed.
9. Prepare the track title, artist name, album title, and other metadata.
10. Prepare the album cover artwork.
11. Register the track or single album on JJAIMSAE.
12. Review the registered music and release information one final time.

## 4. Important Usage Notes

JJAIMSAE MASTER makes music production and registration more convenient, but the user remains responsible for managing and approving the final release.

- Authenticate Suno features with your own account.
- Keep backup copies of important original audio files.
- Always listen to the full track after automatic mastering.
- Remember that M4A downloads are limited to 20 per day.
- Whenever possible, manage and register the final release master directly.
- Verify the track title, artist name, album title, and cover artwork before registration.
- When using an SRT file, confirm that the lyrics match the timing of the actual music.
- Before publishing or distributing any content, confirm that you have the necessary rights to the music, lyrics, images, and other materials, and review the applicable terms of service.

## 5. The Role of JJAIMSAE MASTER

JJAIMSAE MASTER connects the music creation stage with the content management and release stage:

```text
Music creation
    -> Authentication
    -> Audio and project management
    -> Mastering
    -> Lyrics and SRT management
    -> Final master management
    -> Album preparation
    -> JJAIMSAE registration
```

JJAIMSAE MASTER should therefore be understood not simply as a Suno music downloader, but as a music content production and management tool for organizing finished music, creating release-ready masters, and preparing tracks or single albums for registration on JJAIMSAE.

## 6. Version 1.0.1 Update

Version 1.0.1 includes the following changes:

1. Fixed errors caused by changes to the input fields on `jjaimsae.com`.
2. Updated the SRT download process so that a download can proceed only after user approval.
