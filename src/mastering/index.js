const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const downloadBtn = document.getElementById('download-btn');
const audioDownloadBtn = document.getElementById('audio-download-btn');
const collapseAllBtn = document.getElementById('collapse-all-btn');
const expandAllBtn = document.getElementById('expand-all-btn');

function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-mode', isLight);
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isLight));
    if (themeIcon) themeIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    if (themeToggle) {
        const nextLabel = isLight ? '다크 모드로 전환' : '라이트 모드로 전환';
        themeToggle.setAttribute('aria-label', nextLabel);
        themeToggle.setAttribute('title', nextLabel);
    }
}

function getStoredTheme() {
    try {
        return localStorage.getItem('jd-theme') || 'dark';
    } catch (error) {
        return 'dark';
    }
}

function setStoredTheme(theme) {
    try {
        localStorage.setItem('jd-theme', theme);
    } catch (error) {}
}

const savedTheme = getStoredTheme();
applyTheme(savedTheme);

if (themeToggle) {
    themeToggle.onclick = () => {
        const nextTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
        setStoredTheme(nextTheme);
        applyTheme(nextTheme);
        updateCompressorRangeFills();
        compressor.drawCurve();
    };
}

const playerSettingsBtn = document.getElementById('player-settings-btn');
const playerSettingsMenu = document.getElementById('player-settings-menu');
const playerModeInner = document.getElementById('player-mode-inner');
const playerModeFloat = document.getElementById('player-mode-float');
const playerFloatToggle = document.getElementById('player-float-toggle');
const exportPrefixInput = document.getElementById('export-prefix-input');
const exportFilenamePreview = document.getElementById('export-filename-preview');
const stemConsoleVisibilitySetting = document.getElementById('setting-show-stem-console');
const stemConsoleSection = document.getElementById('stem-console-section');
const aiPresetVisibilitySetting = document.getElementById('setting-show-ai-presets');
const aiPresetSection = document.getElementById('ai-100-preset-section');
const jjimMasteredTargetsVisibilitySetting = document.getElementById('setting-show-jjim-mastered-targets');
const jjimMasteredTargetActions = document.getElementById('jjim-mastered-target-actions');
const jjimHandoffPanel = document.getElementById('jjim-handoff-panel');
const jjimHandoffToggle = document.getElementById('jjim-handoff-toggle');
const jjimHandoffContent = document.getElementById('jjim-handoff-content');
const jjimHandoffChevron = document.getElementById('jjim-handoff-chevron');
const aiMicroPresetScaleInput = document.getElementById('ai-micro-preset-scale');
const spectrumBandCountInput = document.getElementById('spectrum-band-count');
const spectrumBarsBtn = document.getElementById('spectrum-bars-btn');
const spectrumWaveBtn = document.getElementById('spectrum-wave-btn');
const spectrumComboBtn = document.getElementById('spectrum-combo-btn');
const globalPlayerShell = document.getElementById('global-player-shell');
const PLAYER_MODE_STORAGE_KEY = 'jd-player-display-mode';
const EXPORT_PREFIX_STORAGE_KEY = 'jd-export-filename-prefix';
const STEM_CONSOLE_VISIBLE_STORAGE_KEY = 'jd-show-stem-console';
const AI_PRESETS_VISIBLE_STORAGE_KEY = 'jd-show-ai-100-presets';
const JJIM_MASTERED_TARGETS_VISIBLE_STORAGE_KEY = 'jd-show-jjim-mastered-targets';
const AI_MICRO_PRESET_SCALE_STORAGE_KEY = 'jd-ai-micro-preset-scale';
const SPECTRUM_BAND_COUNT_STORAGE_KEY = 'jd-spectrum-band-count';
const SPECTRUM_VIEW_MODE_STORAGE_KEY = 'jd-spectrum-view-mode';
const DEFAULT_EXPORT_PREFIX = 'mastered_';
const DEFAULT_SPECTRUM_BAND_COUNT = 64;
const DEFAULT_AI_MICRO_PRESET_SCALE = 0.3;
let spectrumBandCount = DEFAULT_SPECTRUM_BAND_COUNT;
let spectrumViewMode = 'bars';
let aiMicroPresetScale = DEFAULT_AI_MICRO_PRESET_SCALE;
let activeMicroPresetIndex = null;

const masterLoudnessPanel = document.getElementById('master-loudness-panel');
if (masterLoudnessPanel && jjimHandoffPanel) {
    masterLoudnessPanel.insertAdjacentElement('afterend', jjimHandoffPanel);
}

function getStoredPlayerMode() {
    try {
        return localStorage.getItem(PLAYER_MODE_STORAGE_KEY) === 'float' ? 'float' : 'inner';
    } catch (error) {
        return 'inner';
    }
}

function applyPlayerMode(mode, persist = true) {
    const normalizedMode = mode === 'float' ? 'float' : 'inner';
    const isFloating = normalizedMode === 'float';
    document.body.classList.toggle('player-float', isFloating);
    if (globalPlayerShell) globalPlayerShell.dataset.playerMode = normalizedMode;
    if (playerModeInner) playerModeInner.checked = normalizedMode === 'inner';
    if (playerModeFloat) playerModeFloat.checked = normalizedMode === 'float';
    if (playerFloatToggle) {
        playerFloatToggle.classList.toggle('is-floating', isFloating);
        playerFloatToggle.setAttribute('aria-pressed', String(isFloating));
        playerFloatToggle.title = isFloating ? '플레이바 원래 위치로 복귀' : '플레이바 플로팅';
        playerFloatToggle.setAttribute('aria-label', playerFloatToggle.title);
        playerFloatToggle.innerHTML = `<i class="fa-solid fa-${isFloating ? 'compress' : 'up-right-and-down-left-from-center'}"></i>`;
    }
    if (persist) {
        try { localStorage.setItem(PLAYER_MODE_STORAGE_KEY, normalizedMode); } catch (error) {}
    }
}

function setPlayerSettingsOpen(open) {
    if (!playerSettingsBtn || !playerSettingsMenu) return;
    playerSettingsMenu.classList.toggle('hidden', !open);
    playerSettingsBtn.setAttribute('aria-expanded', String(open));
}

if (playerSettingsBtn && playerSettingsMenu) {
    playerSettingsBtn.onclick = (event) => {
        event.stopPropagation();
        setPlayerSettingsOpen(playerSettingsMenu.classList.contains('hidden'));
    };
    playerSettingsMenu.onclick = (event) => event.stopPropagation();
    document.addEventListener('click', () => setPlayerSettingsOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setPlayerSettingsOpen(false);
    });
}
if (playerModeInner) playerModeInner.onchange = () => {
    if (playerModeInner.checked) {
        applyPlayerMode('inner');
        setPlayerSettingsOpen(false);
    }
};
if (playerModeFloat) playerModeFloat.onchange = () => {
    if (playerModeFloat.checked) {
        applyPlayerMode('float');
        setPlayerSettingsOpen(false);
    }
};
if (playerFloatToggle) {
    playerFloatToggle.onclick = () => {
        applyPlayerMode(document.body.classList.contains('player-float') ? 'inner' : 'float');
    };
}
document.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    const tagName = target?.tagName?.toLowerCase();
    const isEditable = target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    if (isEditable) return;
    if (event.key === '1' || event.code === 'Digit1' || event.code === 'Numpad1') {
        event.preventDefault();
        applyPlayerMode('float');
        setPlayerSettingsOpen(false);
    } else if (event.key === '2' || event.code === 'Digit2' || event.code === 'Numpad2') {
        event.preventDefault();
        applyPlayerMode('inner');
        setPlayerSettingsOpen(false);
    }
});
applyPlayerMode(getStoredPlayerMode(), false);

function applyStemConsoleVisibility(visible, persist = true) {
    const shouldShow = Boolean(visible);
    if (stemConsoleSection) stemConsoleSection.hidden = !shouldShow;
    if (stemConsoleVisibilitySetting) stemConsoleVisibilitySetting.checked = shouldShow;
    if (persist) {
        try { localStorage.setItem(STEM_CONSOLE_VISIBLE_STORAGE_KEY, String(shouldShow)); } catch (error) {}
    }
}

let shouldShowStemConsole = false;
try {
    shouldShowStemConsole = localStorage.getItem(STEM_CONSOLE_VISIBLE_STORAGE_KEY) === 'true';
} catch (error) {}
applyStemConsoleVisibility(shouldShowStemConsole, false);

if (stemConsoleVisibilitySetting) {
    stemConsoleVisibilitySetting.onchange = () => {
        applyStemConsoleVisibility(stemConsoleVisibilitySetting.checked);
        window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    };
}

function applyAiPresetVisibility(visible, persist = true) {
    const shouldShow = Boolean(visible);
    if (aiPresetSection) aiPresetSection.hidden = !shouldShow;
    if (aiPresetVisibilitySetting) aiPresetVisibilitySetting.checked = shouldShow;
    if (persist) {
        try { localStorage.setItem(AI_PRESETS_VISIBLE_STORAGE_KEY, String(shouldShow)); } catch (error) {}
    }
}

let shouldShowAiPresets = false;
try {
    shouldShowAiPresets = localStorage.getItem(AI_PRESETS_VISIBLE_STORAGE_KEY) === 'true';
} catch (error) {}
applyAiPresetVisibility(shouldShowAiPresets, false);

if (aiPresetVisibilitySetting) {
    aiPresetVisibilitySetting.onchange = () => {
        applyAiPresetVisibility(aiPresetVisibilitySetting.checked);
        window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    };
}

function applyJjimMasteredTargetsVisibility(visible, persist = true) {
    const shouldShow = Boolean(visible);
    if (jjimMasteredTargetActions) jjimMasteredTargetActions.hidden = !shouldShow;
    if (jjimMasteredTargetsVisibilitySetting) jjimMasteredTargetsVisibilitySetting.checked = shouldShow;
    if (persist) {
        try { localStorage.setItem(JJIM_MASTERED_TARGETS_VISIBLE_STORAGE_KEY, String(shouldShow)); } catch (error) {}
    }
}

let shouldShowJjimMasteredTargets = false;
try {
    shouldShowJjimMasteredTargets = localStorage.getItem(JJIM_MASTERED_TARGETS_VISIBLE_STORAGE_KEY) === 'true';
} catch (error) {}
applyJjimMasteredTargetsVisibility(shouldShowJjimMasteredTargets, false);
if (jjimMasteredTargetsVisibilitySetting) {
    jjimMasteredTargetsVisibilitySetting.onchange = () => {
        applyJjimMasteredTargetsVisibility(jjimMasteredTargetsVisibilitySetting.checked);
    };
}

if (jjimHandoffToggle && jjimHandoffContent) {
    jjimHandoffToggle.onclick = () => {
        const collapsed = !jjimHandoffContent.classList.contains('hidden');
        setPanelCollapsed(jjimHandoffContent, collapsed, {
            button: jjimHandoffToggle,
            icon: jjimHandoffChevron
        });
    };
}

function normalizeAiMicroPresetScale(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
        ? Math.max(0.1, Math.min(2, Math.round(parsed * 100) / 100))
        : DEFAULT_AI_MICRO_PRESET_SCALE;
}

function reapplyActiveMicroPreset() {
    if (activeMicroPresetIndex === null || activeMicroPresetIndex < 0) return;
    const name = presetNames[activeMicroPresetIndex];
    if (!name) return;
    audioState.eqEnabled = true;
    const presetValues = buildMicroMasterPreset(name, activeMicroPresetIndex);
    presetValues.forEach((value, idx) => {
        eq.setEQValue(idx, value, audioCtx, getPlayState, getBypassState, false);
    });
    eq.updateUI();
    if (audioCtx && isPlaying) eq.applySettings(audioCtx, getBypassState());
}

function applyAiMicroPresetScale(value, persist = true) {
    aiMicroPresetScale = normalizeAiMicroPresetScale(value);
    if (aiMicroPresetScaleInput) aiMicroPresetScaleInput.value = String(aiMicroPresetScale);
    if (persist) {
        try { localStorage.setItem(AI_MICRO_PRESET_SCALE_STORAGE_KEY, String(aiMicroPresetScale)); } catch (error) {}
    }
    reapplyActiveMicroPreset();
}

let storedAiMicroPresetScale = DEFAULT_AI_MICRO_PRESET_SCALE;
try {
    storedAiMicroPresetScale = localStorage.getItem(AI_MICRO_PRESET_SCALE_STORAGE_KEY) || DEFAULT_AI_MICRO_PRESET_SCALE;
} catch (error) {}
applyAiMicroPresetScale(storedAiMicroPresetScale, false);

if (aiMicroPresetScaleInput) {
    aiMicroPresetScaleInput.oninput = () => {
        if (aiMicroPresetScaleInput.value !== '') applyAiMicroPresetScale(aiMicroPresetScaleInput.value);
    };
    aiMicroPresetScaleInput.onblur = () => applyAiMicroPresetScale(aiMicroPresetScaleInput.value);
}

function normalizeSpectrumBandCount(value) {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? Math.max(8, Math.min(64, parsed)) : DEFAULT_SPECTRUM_BAND_COUNT;
}

function applySpectrumBandCount(value, persist = true) {
    spectrumBandCount = normalizeSpectrumBandCount(value);
    if (spectrumBandCountInput) spectrumBandCountInput.value = String(spectrumBandCount);
    if (persist) {
        try { localStorage.setItem(SPECTRUM_BAND_COUNT_STORAGE_KEY, String(spectrumBandCount)); } catch (error) {}
    }
}

function applySpectrumViewMode(mode, persist = true) {
    spectrumViewMode = mode === 'wave' || mode === 'combo' ? mode : 'bars';
    const isWave = spectrumViewMode === 'wave';
    const isCombo = spectrumViewMode === 'combo';
    const isBars = spectrumViewMode === 'bars';
    spectrumBarsBtn?.classList.toggle('is-active', isBars);
    spectrumWaveBtn?.classList.toggle('is-active', isWave);
    spectrumComboBtn?.classList.toggle('is-active', isCombo);
    spectrumBarsBtn?.setAttribute('aria-pressed', String(isBars));
    spectrumWaveBtn?.setAttribute('aria-pressed', String(isWave));
    spectrumComboBtn?.setAttribute('aria-pressed', String(isCombo));
    if (persist) {
        try { localStorage.setItem(SPECTRUM_VIEW_MODE_STORAGE_KEY, spectrumViewMode); } catch (error) {}
    }
}

let storedSpectrumBandCount = DEFAULT_SPECTRUM_BAND_COUNT;
let storedSpectrumViewMode = 'bars';
try {
    const rawSpectrumBandCount = localStorage.getItem(SPECTRUM_BAND_COUNT_STORAGE_KEY);
    storedSpectrumBandCount = (!rawSpectrumBandCount || rawSpectrumBandCount === '20') ? DEFAULT_SPECTRUM_BAND_COUNT : rawSpectrumBandCount;
    storedSpectrumViewMode = localStorage.getItem(SPECTRUM_VIEW_MODE_STORAGE_KEY) || 'bars';
} catch (error) {}
applySpectrumBandCount(storedSpectrumBandCount, false);
applySpectrumViewMode(storedSpectrumViewMode, false);

if (spectrumBandCountInput) {
    spectrumBandCountInput.oninput = () => {
        if (spectrumBandCountInput.value !== '') applySpectrumBandCount(spectrumBandCountInput.value);
    };
    spectrumBandCountInput.onblur = () => applySpectrumBandCount(spectrumBandCountInput.value);
}
if (spectrumBarsBtn) spectrumBarsBtn.onclick = () => applySpectrumViewMode('bars');
if (spectrumWaveBtn) spectrumWaveBtn.onclick = () => applySpectrumViewMode('wave');
if (spectrumComboBtn) spectrumComboBtn.onclick = () => applySpectrumViewMode('combo');

const eqLabels = ["20", "31.5", "50", "80", "125", "200", "315", "500", "800", "1k", "1.25k", "2k", "3.15k", "4k", "5k", "6.3k", "8k", "10k", "12.5k", "16k"];

const stemRegistry = [
    { id: "s1", name: "CH 1: Kick (드럼 저역 타격음)", freq: 60, type: "lowshelf", color: "text-amber-400", accent: "accent-amber-500" },
    { id: "s2", name: "CH 2: Snare (드럼 스네어 중역 타격)", freq: 220, type: "peaking", color: "text-amber-400", accent: "accent-amber-500" },
    { id: "s3", name: "CH 3: Hi-Hats (드럼 심벌 고역 금속음)", freq: 8500, type: "highshelf", color: "text-amber-300", accent: "accent-amber-400" },
    { id: "s4", name: "CH 4: Toms/Perc (탐탐 퍼커션 세션)", freq: 160, type: "peaking", color: "text-amber-300", accent: "accent-amber-400" },
    { id: "s5", name: "CH 5: Sub-Bass (서브 베이스 초저역)", freq: 45, type: "lowshelf", color: "text-emerald-400", accent: "accent-emerald-500" },
    { id: "s6", name: "CH 6: Synth Bass (베이스 라인 리듬축)", freq: 120, type: "peaking", color: "text-emerald-400", accent: "accent-emerald-500" },
    { id: "s7", name: "CH 7: Lead Vocal (메인 보컬 센터 라인)", freq: 2000, type: "peaking", color: "text-purple-400", accent: "accent-purple-500" },
    { id: "s8", name: "CH 8: Chorus/Back (코러스 서브 화음단)", freq: 3000, type: "peaking", color: "text-purple-300", accent: "accent-purple-400" },
    { id: "s9", name: "CH 9: Ac.Guitar (통기타 스트로크 선율)", freq: 350, type: "peaking", color: "text-cyan-400", accent: "accent-cyan-500" },
    { id: "s10", name: "CH 10: El.Guitar (일렉 기타 배킹 락)", freq: 1500, type: "peaking", color: "text-cyan-400", accent: "accent-cyan-500" },
    { id: "s11", name: "CH 11: Ac.Piano (그랜드 피아노 메인)", freq: 600, type: "peaking", color: "text-blue-400", accent: "accent-blue-500" },
    { id: "s12", name: "CH 12: E.Piano/Clav (일렉트릭 건반 백킹)", freq: 900, type: "peaking", color: "text-blue-400", accent: "accent-blue-500" },
    { id: "s13", name: "CH 13: Lead Synth (신디사이저 멜로디 리드)", freq: 2500, type: "peaking", color: "text-sky-400", accent: "accent-sky-500" },
    { id: "s14", name: "CH 14: Synth Pad (배경 앰비언트 패드)", freq: 1100, type: "peaking", color: "text-sky-400", accent: "accent-sky-500" },
    { id: "s15", name: "CH 15: Strings Ens (현악 오케스트라 앙상블)", freq: 3200, type: "peaking", color: "text-pink-400", accent: "accent-pink-500" },
    { id: "s16", name: "CH 16: Brass Section (관악 브라스 힛 파트)", freq: 1800, type: "peaking", color: "text-orange-400", accent: "accent-orange-500" },
    { id: "s17", name: "CH 17: Woodwinds (플루트 등 목관 악기)", freq: 2300, type: "peaking", color: "text-teal-400", accent: "accent-teal-500" },
    { id: "s18", name: "CH 18: Sound Effects (SFX 특수 인펙트 효과)", freq: 12000, type: "highshelf", color: "text-rose-400", accent: "accent-rose-500" },
    { id: "s19", name: "CH 19: Reverb Tail (리버브 잔향 공간감)", freq: 5000, type: "peaking", color: "text-fuchsia-400", accent: "accent-fuchsia-500" },
    { id: "s20", name: "CH 20: Delay Echo (딜레이 피드백 반복)", freq: 4000, type: "peaking", color: "text-fuchsia-400", accent: "accent-fuchsia-500" }
];

const presetNames = [
    "Low Shelf +0.3", "Low Shelf +0.5", "Low Shelf -0.3", "Low Shelf -0.5", "Sub Clean -0.4",
    "Kick Weight +0.4", "Mud Trim -0.4", "Mud Trim -0.7", "Low-Mid Body +0.3", "Low-Mid Body -0.3",
    "Box Trim -0.4", "Box Trim -0.6", "Warm Tilt +0.4", "Cool Tilt -0.4", "Neutral Polish A",
    "Neutral Polish B", "Center Clarity +0.3", "Vocal Pocket +0.4", "Vocal Harsh -0.3", "Vocal Air +0.5",
    "Presence +0.3", "Presence +0.5", "Presence Trim -0.3", "Presence Trim -0.5", "Sibilance Soft -0.4",
    "Air Shelf +0.3", "Air Shelf +0.6", "Air Shelf -0.3", "Top Smooth -0.4", "Top Smooth -0.6",
    "Stereo Master Flat+", "Streaming Soft A", "Streaming Soft B", "Streaming Bright A", "Streaming Warm A",
    "Pop Micro Lift", "Pop Vocal Seat", "Pop Low Control", "Pop Air Control", "Pop Dense Trim",
    "Hip-Hop Sub Tight", "Hip-Hop Vocal Clear", "Hip-Hop Hi-Hat Soft", "Hip-Hop Low-Mid Trim", "Hip-Hop Air Small",
    "Rock Body Small", "Rock Edge Tame", "Rock Presence Small", "Rock Low Tight", "Rock Top Smooth",
    "Metal Low Tight", "Metal Bite Trim", "Metal Air Small", "Metal Mud Cut", "Metal Presence Seat",
    "Acoustic Body +0.3", "Acoustic Boom -0.4", "Acoustic String Air", "Acoustic Pick Soft", "Acoustic Natural",
    "Piano Body +0.3", "Piano Box -0.4", "Piano Air +0.4", "Piano Bright Tame", "Piano Warm Micro",
    "EDM Sub Guard", "EDM Kick Seat", "EDM Top Smooth", "EDM Air +0.5", "EDM Mid Clean",
    "R&B Warm Micro", "R&B Vocal Silk", "R&B Low Tight", "R&B Air Soft", "R&B Presence Seat",
    "Jazz Natural A", "Jazz Natural B", "Jazz Low Clean", "Jazz Air Small", "Jazz Harsh Trim",
    "Cinematic Low +0.4", "Cinematic Mud -0.3", "Cinematic Air +0.5", "Cinematic Smooth Top", "Cinematic Neutral",
    "Podcast Body +0.3", "Podcast Mud -0.5", "Podcast Presence +0.4", "Podcast Sibilance -0.5", "Podcast Air -0.3",
    "Vinyl Low Trim", "Tape Soft Top", "Tube Warm Small", "Clean Translation", "Mono Safe Trim",
    "Car Check Low", "Earbud Clarity", "Laptop Low-Mid Trim", "Club Low Guard", "Master Final Polish"
];

const audioState = {
    eq: new Array(20).fill(0),
    eqEnabled: false,
    stems: {},
    stemsEnabled: false,
    mutes: {}, 
    noise: 0,
    noiseEnabled: false,
    deesser: 0,
    deesserEnabled: false,
    saturator: 0, 
    saturatorEnabled: false,
    masterSaturation: {
        enabled: false,
        drive: 2.3,
        mix: 61,
        output: 0,
        tone: 12,
        bias: 0,
        character: 42,
        evenOdd: 35,
        dynamics: -10,
        oversampling: 4,
        mode: "tube",
        bandLow: 223,
        bandHigh: 2350
    },
    spread: {
        enabled: false,
        spread: 45,
        centerDb: 0,
        sideDb: -9,
        lowCutHz: 160
    },
    reverb: {
        enabled: false,
        preDelay: 105,
        decay: 1.8,
        diffusion: 58,
        lowGain: -1,
        highGain: 1.5,
        mix: 22
    },
    compressor: {
        enabled: false,
        inputGain: 0,
        threshold: -24,
        ratio: 4,
        attack: 0.003,
        release: 0.25,
        knee: 30,
        makeup: 6
    },
    limiter: {
        enabled: false,
        threshold: -1,
        release: 100,
        outputGain: 0
    },
    pan: 0,
    front: 0,
    master: 100
};

stemRegistry.forEach(s => {
    audioState.stems[s.id] = 0;
    audioState.mutes[s.id] = false;
});

// Initialize effector modules
const eq = new EQEffector(audioState);
const reverb = new ReverbEffector(audioState);
const compressor = new CompressorEffector(audioState);
const limiter = new LimiterEffector(audioState);
const saturation = new SaturationEffector(audioState);
const spread = new SpreadEffector(audioState);

let audioCtx = null;
let originalBuffer = null;
let sourceNode = null;
let isPlaying = false;
let startTime = 0;
let pausedAt = 0;
let isBypassed = true;
let isLooping = false;
let sectionRepeatEnabled = false;
let sectionRepeatStart = 0;
let sectionRepeatEnd = 0;
let sectionRepeatInitialized = false;
let sectionRepeatDrag = null;
let sectionRepeatSeeking = false;
let isUserSeeking = false; 
let activeStemIds = [];
let waveformPeaks = [];
let masteredWaveformPeaks = [];
const masteredWaveformCache = new WeakMap();
const coveringWaveformCache = new WeakMap();
let waveformRedrawFrame = 0;
let waveformProgress = 0;
let waveformLoadingState = null;
let waveformLoadingFrame = 0;
let waveformMessageTimer = 0;
let currentAudioFileBlob = null;
let currentAudioFileName = "";
let audioTimelineClips = [];
let activeTimelineClipIndex = 0;
let pendingUploadChoiceResolve = null;
let forceAppendNextUpload = false;
let timelineRebuildInProgress = false;
let timelineGapMs = 2000;
let restoringPersistedAudio = false;

function sanitizeFilenamePart(value) {
    return String(value ?? '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').slice(0, 80);
}

function getExportPrefix() {
    const inputValue = exportPrefixInput ? exportPrefixInput.value : DEFAULT_EXPORT_PREFIX;
    return sanitizeFilenamePart(inputValue);
}

function getMasteredExportFilename() {
    const originalBaseName = sanitizeFilenamePart((currentAudioFileName || 'audio').replace(/\.[^/.]+$/, '')) || 'audio';
    return `${getExportPrefix()}${originalBaseName}.wav`;
}

function updateExportFilenamePreview() {
    const filename = getMasteredExportFilename();
    if (exportFilenamePreview) exportFilenamePreview.innerText = filename;
    if (downloadBtn) {
        downloadBtn.title = filename;
        downloadBtn.setAttribute('aria-label', `Mastering Data Execute: ${filename}`);
    }
}

if (exportPrefixInput) {
    try {
        const storedPrefix = localStorage.getItem(EXPORT_PREFIX_STORAGE_KEY);
        exportPrefixInput.value = storedPrefix === null ? DEFAULT_EXPORT_PREFIX : sanitizeFilenamePart(storedPrefix);
    } catch (error) {
        exportPrefixInput.value = DEFAULT_EXPORT_PREFIX;
    }
    exportPrefixInput.oninput = () => {
        const sanitized = sanitizeFilenamePart(exportPrefixInput.value);
        if (exportPrefixInput.value !== sanitized) exportPrefixInput.value = sanitized;
        try { localStorage.setItem(EXPORT_PREFIX_STORAGE_KEY, sanitized); } catch (error) {}
        updateExportFilenamePreview();
    };
}
updateExportFilenamePreview();


let stemFilters = {};
let noiseFilters = { lowCut: null, highCut: null, deEsser: null, waveShaper: null }; 
let frontFilters = { body: null, presence: null, air: null };
let stereoPannerNode = null;
let masterGainNode = null;
let analyserNode = null;
let levelSplitterNode = null;
let levelLeftAnalyser = null;
let levelRightAnalyser = null;
let levelSilentGain = null;
let realtimeGraphInputNode = null;
let realtimeGraphOutputNode = null;
let realtimeGraphPromise = null;
let spectrumDataArray = null;
const analyserSampleBuffers = new WeakMap();

const playBtn = document.getElementById('play-btn');
const loopBtn = document.getElementById('loop-btn');
const upload = document.getElementById('audio-upload');
const exportProgressPanel = document.getElementById('export-progress-panel');
const exportProgressFill = document.getElementById('export-progress-fill');
const exportProgressText = document.getElementById('export-progress-text');
const exportStatusText = document.getElementById('export-status-text');
const exportCancelBtn = document.getElementById('export-cancel-btn');
const trackName = document.getElementById('track-name');
const timeDisplay = document.getElementById('time-display');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const skipBackBtn = document.getElementById('skip-back-btn');
const skipForwardBtn = document.getElementById('skip-forward-btn');
const trackPrevBtn = document.getElementById('track-prev-btn');
const trackNextBtn = document.getElementById('track-next-btn');
const trackNav = document.querySelector('.transport-track-nav');
const seekStartBtn = document.getElementById('seek-start-btn');
const seekEndBtn = document.getElementById('seek-end-btn');
const panControl = document.getElementById('pan-control');
const panValue = document.getElementById('pan-val');
const frontControl = document.getElementById('front-control');
const frontValue = document.getElementById('front-val');
const sectionRepeatBtn = document.getElementById('section-repeat-btn');
const sectionRepeatEditor = document.getElementById('section-repeat-editor');
const sectionRepeatBar = document.getElementById('section-repeat-bar');
const sectionRepeatRegion = document.getElementById('section-repeat-region');
const sectionRepeatPlayhead = document.getElementById('section-repeat-playhead');
const sectionRepeatStartHandle = document.getElementById('section-repeat-start-handle');
const sectionRepeatEndHandle = document.getElementById('section-repeat-end-handle');
const sectionRepeatStartLabel = document.getElementById('section-repeat-start-label');
const sectionRepeatEndLabel = document.getElementById('section-repeat-end-label');
const sectionRepeatStartBadge = document.getElementById('section-repeat-start-badge');
const sectionRepeatEndBadge = document.getElementById('section-repeat-end-badge');
const sectionRepeatDurationLabel = document.getElementById('section-repeat-duration-label');
const levelMeter = document.querySelector('.output-level-meter');
const levelMeterLeft = document.getElementById('level-meter-left');
const levelMeterRight = document.getElementById('level-meter-right');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const spectrumAnalyzerPanel = document.getElementById('spectrum-analyzer-panel');
const spectrumHeightResizer = document.getElementById('spectrum-height-resizer');
const detectorStatus = document.getElementById('detector-status');
const clipLed = document.getElementById('clip-led');
const lufsBar = document.getElementById('lufs-bar');
const lufsText = document.getElementById('lufs-text');
const waveformCanvas = document.getElementById('audio-waveform');
const waveformCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;
const waveformTime = document.getElementById('waveform-time');
const waveformLoadMessage = document.getElementById('waveform-load-message');
const waveformLyrics = document.getElementById('waveform-lyrics');
const waveformLyricsText = document.getElementById('waveform-lyrics-text');
const audioUploadChoice = document.getElementById('audio-upload-choice');
const audioUploadChoiceFile = document.getElementById('audio-upload-choice-file');
const audioUploadReplaceBtn = document.getElementById('audio-upload-replace');
const audioUploadAppendBtn = document.getElementById('audio-upload-append');
const audioTimelinePanel = document.getElementById('audio-timeline-panel');
const audioTimelineHeader = document.getElementById('audio-timeline-header');
const audioTimelineContent = document.getElementById('audio-timeline-content');
const audioTimelineChevron = document.getElementById('audio-timeline-chevron');
const audioTimelineSummary = document.getElementById('audio-timeline-summary');
const audioTimelineStrip = document.getElementById('audio-timeline-strip');
const audioTimelineGapInput = document.getElementById('audio-timeline-gap');
const audioTimelineGapValue = document.getElementById('audio-timeline-gap-val');
const audioTimelineGapMinus = document.getElementById('audio-timeline-gap-minus');
const audioTimelineGapPlus = document.getElementById('audio-timeline-gap-plus');
const audioTimelineGapApplyAll = document.getElementById('audio-timeline-gap-apply-all');
const compGrBar = document.getElementById('comp-gr-bar');
const compGrVal = document.getElementById('comp-gr-val');

let timedLyrics = [];
let activeLyricCueIndex = -2;

function parseSubtitleTimestamp(value) {
    const match = String(value || '').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/);
    if (!match) return Number.NaN;
    const milliseconds = match[4].padEnd(3, '0').slice(0, 3);
    return ((Number(match[1] || 0) * 60 * 60) + (Number(match[2]) * 60) + Number(match[3])) + (Number(milliseconds) / 1000);
}

function parseTimedLyrics(value) {
    const normalized = String(value || '').replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
    if (!normalized) return [];
    const cues = [];
    normalized.split(/\n{2,}/).forEach(block => {
        const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
        const timingIndex = lines.findIndex(line => line.includes('-->'));
        if (timingIndex < 0) return;
        const timing = lines[timingIndex].split('-->');
        const start = parseSubtitleTimestamp(timing[0]);
        const end = parseSubtitleTimestamp((timing[1] || '').trim().split(/\s+/)[0]);
        const text = lines.slice(timingIndex + 1)
            .join('\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .trim();
        if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) cues.push({ start, end, text });
    });
    return cues.sort((a, b) => a.start - b.start || a.end - b.end);
}

function updateTimedLyrics(current = 0, force = false) {
    if (!waveformLyrics || !waveformLyricsText) return;
    if (!timedLyrics.length) {
        waveformLyrics.classList.add('hidden');
        waveformLyricsText.textContent = '';
        activeLyricCueIndex = -2;
        return;
    }
    waveformLyrics.classList.remove('hidden');
    const cueIndex = timedLyrics.findIndex(cue => current >= cue.start && current < cue.end);
    if (!force && cueIndex === activeLyricCueIndex) return;
    activeLyricCueIndex = cueIndex;
    const cue = cueIndex >= 0 ? timedLyrics[cueIndex] : null;
    waveformLyrics.classList.toggle('is-gap', !cue);
    waveformLyricsText.textContent = cue?.text || '· · ·';
}

function setTimedLyrics(value) {
    timedLyrics = parseTimedLyrics(value);
    activeLyricCueIndex = -2;
    updateTimedLyrics(isPlaying && audioCtx ? audioCtx.currentTime - startTime : pausedAt, true);
}

window.addEventListener('jjim-lyrics-change', event => setTimedLyrics(event.detail?.text || ''));

function setAudioTransportAvailability(enabled) {
    document.querySelectorAll('[data-audio-transport]').forEach((button) => {
        button.disabled = !enabled;
    });
}

const LEVEL_METER_SEGMENTS = 16;
function setupOutputLevelMeter() {
    [levelMeterLeft, levelMeterRight].forEach((channel) => {
        if (!channel) return;
        channel.replaceChildren(...Array.from({ length: LEVEL_METER_SEGMENTS }, () => document.createElement('i')));
    });
}

function setLevelMeterChannel(channel, level) {
    if (!channel) return;
    const segments = Array.from(channel.children);
    const filled = Math.round(Math.max(0, Math.min(1, level)) * segments.length);
    segments.forEach((segment, index) => {
        segment.className = index < filled
            ? index >= segments.length - 2 ? 'is-clip' : index >= segments.length - 5 ? 'is-warn' : 'is-lit'
            : '';
    });
}

function readAnalyserLevel(analyser) {
    if (!analyser || !isPlaying) return 0;
    let samples = analyserSampleBuffers.get(analyser);
    if (!samples || samples.length !== analyser.fftSize) {
        samples = new Float32Array(analyser.fftSize);
        analyserSampleBuffers.set(analyser, samples);
    }
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    let peak = 0;
    for (const sample of samples) {
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
    }
    return Math.min(1, Math.max(Math.sqrt(sum / samples.length) * 2.4, peak));
}

function updateOutputLevelMeter() {
    const left = readAnalyserLevel(levelLeftAnalyser);
    const right = readAnalyserLevel(levelRightAnalyser);
    setLevelMeterChannel(levelMeterLeft, left);
    setLevelMeterChannel(levelMeterRight, right);
    levelMeter?.setAttribute('aria-valuenow', String(Math.round(Math.max(left, right) * 100)));
}

setupOutputLevelMeter();

function setupMasterEffectPanels() {
    const target = document.getElementById('main-master-effects');
    if (!target) return;
    ['master-limiter-panel', 'master-reverb-panel', 'master-compressor-panel'].forEach((panelId) => {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        target.appendChild(panel);
        panel.classList.add('main-effect-panel');
        const header = panel.firstElementChild;
        if (!header || header.classList.contains('effect-panel-header')) return;
        header.classList.add('effect-panel-header');
        const content = document.createElement('div');
        content.className = 'effect-panel-content';
        while (header.nextSibling) content.appendChild(header.nextSibling);
        panel.appendChild(content);

        const toggle = header.querySelector('button');
        const actions = document.createElement('span');
        actions.className = 'effect-panel-header-actions';
        if (toggle) actions.appendChild(toggle);
        const collapse = document.createElement('button');
        collapse.type = 'button';
        collapse.className = 'effect-collapse-btn';
        const advancedContent = panelId === 'master-limiter-panel'
            ? content.querySelector('.limiter-advanced-content')
            : null;
        if (advancedContent) {
            const advancedToggle = document.createElement('button');
            advancedToggle.type = 'button';
            advancedToggle.className = 'effect-collapse-btn limiter-advanced-toggle-btn';
            advancedToggle.setAttribute('aria-controls', 'limiter-advanced-content');
            advancedToggle.setAttribute('aria-expanded', String(!advancedContent.classList.contains('is-collapsed')));
            advancedToggle.setAttribute('aria-label', '리미터 하단 고급 기능 펼치기');
            advancedToggle.title = '리미터 하단 고급 기능';
            advancedToggle.innerHTML = '<i class="fa-solid fa-chart-line"></i>';
            advancedToggle.onclick = () => {
                if (content.classList.contains('is-collapsed')) {
                    content.classList.remove('is-collapsed');
                    const mainCollapse = panel.querySelector('.effect-collapse-btn:not(.limiter-advanced-toggle-btn)');
                    const mainIcon = mainCollapse?.querySelector('i');
                    mainCollapse?.setAttribute('aria-expanded', 'true');
                    mainCollapse?.setAttribute('aria-label', '패널 접기');
                    if (mainIcon) mainIcon.className = 'fa-solid fa-chevron-up';
                }
                const collapsed = !advancedContent.classList.contains('is-collapsed');
                advancedContent.classList.toggle('is-collapsed', collapsed);
                advancedToggle.setAttribute('aria-expanded', String(!collapsed));
                advancedToggle.setAttribute('aria-label', collapsed ? '리미터 하단 고급 기능 펼치기' : '리미터 하단 고급 기능 접기');
                advancedToggle.classList.toggle('is-active', !collapsed);
                window.setTimeout(() => {
                    handleResize();
                    limiter.updateLimiterVisualizers?.();
                }, 0);
            };
            actions.appendChild(advancedToggle);
        }
        const collapseTarget = content;
        const startsCollapsed = collapseTarget.classList.contains('is-collapsed');
        collapse.setAttribute('aria-expanded', String(!startsCollapsed));
        collapse.setAttribute('aria-label', startsCollapsed ? '패널 펼치기' : '패널 접기');
        collapse.innerHTML = `<i class="fa-solid fa-chevron-${startsCollapsed ? 'down' : 'up'}"></i>`;
        collapse.onclick = () => {
            const collapsed = !collapseTarget.classList.contains('is-collapsed');
            collapseTarget.classList.toggle('is-collapsed', collapsed);
            collapse.setAttribute('aria-expanded', String(!collapsed));
            collapse.setAttribute('aria-label', collapsed ? '패널 펼치기' : '패널 접기');
            collapse.innerHTML = `<i class="fa-solid fa-chevron-${collapsed ? 'down' : 'up'}"></i>`;
            if (!collapsed) {
                window.setTimeout(() => {
                    handleResize();
                    if (advancedContent) limiter.updateLimiterVisualizers?.();
                }, 0);
            }
        };
        actions.appendChild(collapse);
        header.appendChild(actions);
    });
}

setupMasterEffectPanels();

function setPanelCollapsed(content, collapsed, { hiddenClass = 'hidden', icon = null, button = null } = {}) {
    if (!content) return;
    if (hiddenClass === 'is-collapsed') {
        content.classList.toggle('is-collapsed', collapsed);
    } else {
        content.classList.toggle('hidden', collapsed);
    }
    if (button) button.setAttribute('aria-expanded', String(!collapsed));
    if (icon) icon.className = `fa-solid fa-chevron-${collapsed ? 'down' : 'up'}`;
}

function setAllPanelsCollapsed(collapsed) {
    setPanelCollapsed(
        document.getElementById('audio-analysis-content'),
        collapsed,
        {
            button: document.getElementById('audio-analysis-toggle'),
            icon: document.getElementById('audio-analysis-chevron')
        }
    );
    setPanelCollapsed(
        document.getElementById('project-collapse-content'),
        collapsed,
        { icon: document.getElementById('project-collapse-icon') }
    );
    setPanelCollapsed(
        document.getElementById('loudness-panel-content'),
        collapsed,
        {
            hiddenClass: 'is-collapsed',
            button: document.getElementById('loudness-collapse-btn'),
            icon: document.querySelector('#loudness-collapse-btn i')
        }
    );
    setPanelCollapsed(
        document.getElementById('audio-timeline-content'),
        collapsed,
        {
            button: document.getElementById('audio-timeline-header'),
            icon: document.getElementById('audio-timeline-chevron')
        }
    );
    setPanelCollapsed(
        document.getElementById('stems-collapse-content'),
        collapsed,
        { icon: document.getElementById('stems-collapse-icon') }
    );
    setPanelCollapsed(
        document.getElementById('eq-collapse-content'),
        collapsed,
        {
            button: document.getElementById('eq-collapse-btn'),
            icon: document.getElementById('eq-collapse-icon')
        }
    );
    setPanelCollapsed(
        document.getElementById('saturation-collapse-content'),
        collapsed,
        {
            hiddenClass: 'is-collapsed',
            button: document.getElementById('saturation-collapse-btn'),
            icon: document.getElementById('saturation-collapse-icon')
        }
    );
    setPanelCollapsed(
        document.getElementById('spread-collapse-content'),
        collapsed,
        {
            hiddenClass: 'is-collapsed',
            button: document.getElementById('spread-collapse-btn'),
            icon: document.getElementById('spread-collapse-icon')
        }
    );
    document.querySelectorAll('.main-effect-panel .effect-panel-content').forEach((content) => {
        const panel = content.closest('.main-effect-panel');
        const button = panel?.querySelector('.effect-collapse-btn:not(.limiter-advanced-toggle-btn)');
        const icon = button?.querySelector('i');
        setPanelCollapsed(content, collapsed, { hiddenClass: 'is-collapsed', button, icon });
        const advancedContent = panel?.querySelector('.limiter-advanced-content');
        const advancedButton = panel?.querySelector('.limiter-advanced-toggle-btn');
        if (advancedContent && advancedButton) {
            advancedContent.classList.toggle('is-collapsed', collapsed);
            advancedButton.setAttribute('aria-expanded', String(!collapsed));
            advancedButton.setAttribute('aria-label', collapsed ? '리미터 하단 고급 기능 펼치기' : '리미터 하단 고급 기능 접기');
            advancedButton.classList.toggle('is-active', !collapsed);
        }
    });
    if (!collapsed) {
        window.setTimeout(() => {
            handleResize();
            drawLoudnessHistory();
            limiter.updateLimiterVisualizers?.();
            reverb.updateReverbVisualizers?.();
            saturation.updateVisualizers?.();
        }, 0);
    }
}

collapseAllBtn?.addEventListener('click', () => setAllPanelsCollapsed(true));
expandAllBtn?.addEventListener('click', () => setAllPanelsCollapsed(false));
setAllPanelsCollapsed(true);

function setupPlayerSignalLevel() {
    const signalPanel = document.getElementById('signal-output-panel');
    const transportVolume = document.querySelector('.transport-volume');
    if (!signalPanel || !transportVolume) return;
    signalPanel.classList.add('transport-signal-level');
    transportVolume.appendChild(signalPanel);
}

setupPlayerSignalLevel();

function setupResizableEffectGraphs() {
    document.querySelectorAll('.effect-graph-resizer').forEach((resizer) => {
        if (resizer.dataset.resizeBound === 'true') return;
        const shell = document.getElementById(resizer.dataset.resizeTarget);
        if (!shell) return;
        const storageKey = resizer.dataset.resizeKey;
        try {
            const storedHeight = Number(localStorage.getItem(storageKey));
            if (Number.isFinite(storedHeight) && storedHeight >= 176 && storedHeight <= 608) shell.style.height = `${storedHeight}px`;
        } catch (error) {}
        let startY = 0;
        let startHeight = 0;
        const redraw = () => {
            reverb.updateReverbVisualizers?.();
            compressor.drawCurve();
            eq.drawEQCanvas?.();
            saturation.updateVisualizers?.();
        };
        const finish = (event) => {
            if (!resizer.classList.contains('is-resizing')) return;
            resizer.classList.remove('is-resizing');
            if (resizer.hasPointerCapture?.(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
            try { localStorage.setItem(storageKey, String(Math.round(shell.getBoundingClientRect().height))); } catch (error) {}
            redraw();
        };
        resizer.onpointerdown = (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            startY = event.clientY;
            startHeight = shell.getBoundingClientRect().height;
            resizer.classList.add('is-resizing');
            resizer.setPointerCapture?.(event.pointerId);
        };
        resizer.onpointermove = (event) => {
            if (!resizer.classList.contains('is-resizing')) return;
            shell.style.height = `${Math.max(176, Math.min(608, startHeight + event.clientY - startY))}px`;
            redraw();
        };
        resizer.onpointerup = finish;
        resizer.onpointercancel = finish;
        resizer.dataset.resizeBound = 'true';
    });
}

const loudnessMomentary = document.getElementById('loudness-momentary');
const loudnessShort = document.getElementById('loudness-short');
const loudnessIntegrated = document.getElementById('loudness-integrated');
const loudnessLra = document.getElementById('loudness-lra');
const loudnessPeak = document.getElementById('loudness-peak');
const loudnessMeterBars = {
    momentary: document.getElementById('loudness-momentary-bar'),
    shortTerm: document.getElementById('loudness-short-bar'),
    integrated: document.getElementById('loudness-integrated-bar'),
    lra: document.getElementById('loudness-lra-bar'),
    peak: document.getElementById('loudness-peak-bar')
};
const loudnessTime = document.getElementById('loudness-time');
const loudnessHistory = document.getElementById('loudness-history');
const loudnessHistoryResizer = document.getElementById('loudness-history-resizer');
const loudnessHistoryCard = loudnessHistory?.closest('.loudness-history-card');
const loudnessResetBtn = document.getElementById('loudness-reset-btn');
const loudnessCollapseBtn = document.getElementById('loudness-collapse-btn');
const loudnessPanelContent = document.getElementById('loudness-panel-content');
const streamingLimiterSync = document.getElementById('streaming-limiter-sync');
const streamingLimiterOutput = document.getElementById('streaming-limiter-output');
const streamingLimiterStatus = document.getElementById('streaming-limiter-status');
const streamingLimiterFit = document.getElementById('streaming-limiter-fit');
let loudnessSamples = [];
let loudnessChartPoints = [];
let loudnessTruePeak = 0;
let loudnessLastSampleAt = 0;
let loudnessEnergySum = 0;
let streamingFitHoldUntil = 0;
let streamingFitAppliedOutput = null;
let latestIntegratedLufs = NaN;
const LOUDNESS_HISTORY_HEIGHT_KEY = 'jd-loudness-history-height';

function updateStreamingLimiterOutput(limiterState = audioState.limiter) {
    const outputGain = Number(limiterState?.outputGain);
    const enabled = Boolean(limiterState?.enabled);
    if (streamingLimiterOutput) {
        streamingLimiterOutput.innerText = `${Number.isFinite(outputGain) ? outputGain.toFixed(1) : '0.0'} dB`;
    }
    if (streamingLimiterStatus) streamingLimiterStatus.innerText = enabled ? 'SYNC' : 'OUT';
    streamingLimiterSync?.classList.toggle('is-active', enabled);
    streamingLimiterSync?.setAttribute(
        'aria-label',
        `Limiter output ${Number.isFinite(outputGain) ? outputGain.toFixed(1) : '0.0'} decibels, ${enabled ? 'synchronized' : 'bypassed'}`
    );
}

function getLimiterOutputBounds() {
    const input = document.getElementById('limiter-output');
    return {
        min: Number(input?.min ?? -12),
        max: Number(input?.max ?? 6)
    };
}

function clampLimiterOutput(value) {
    const { min, max } = getLimiterOutputBounds();
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(min, Math.min(max, Math.round(numeric * 10) / 10));
}

function applyLimiterOutputFit(targetOutput) {
    const fittedOutput = clampLimiterOutput(targetOutput);
    audioState.limiter.enabled = true;
    audioState.limiter.outputGain = fittedOutput;
    streamingFitHoldUntil = performance.now() + 2500;
    streamingFitAppliedOutput = fittedOutput;
    const outputInput = document.getElementById('limiter-output');
    if (outputInput) outputInput.value = String(fittedOutput);
    limiter.syncInputs?.();
    limiter.updateUI(updateCompressorRangeFills);
    if (isPlaying && audioCtx) limiter.applySettings(audioCtx, getBypassState);
    updateStreamingLimiterOutput(audioState.limiter);
    return fittedOutput;
}

function getStreamingFitRecommendation(integrated) {
    if (!Number.isFinite(integrated)) return null;
    const targets = [...document.querySelectorAll('.target-row')]
        .map((row) => Number(row.dataset.targetLufs))
        .filter(Number.isFinite);
    if (!targets.length) return null;
    const currentOutput = Number(audioState.limiter?.outputGain || 0);
    const adjustments = targets.map((target) => target - integrated);
    const strictestAdjustment = Math.min(...adjustments);
    const hasTooLoudTarget = adjustments.some((adjustment) => adjustment < -0.1);
    return {
        hasTooLoudTarget,
        adjustment: strictestAdjustment,
        output: clampLimiterOutput(currentOutput + strictestAdjustment)
    };
}

function bindStreamingTargetFitButtons() {
    document.querySelectorAll('.target-row').forEach((row) => {
        const button = row.querySelector('.target-fit-btn');
        if (!button || button.dataset.fitBound === 'true') return;
        button.onclick = () => {
            const targetOutput = Number(row.dataset.fitOutput);
            if (!Number.isFinite(targetOutput)) return;
            const fitted = applyLimiterOutputFit(targetOutput);
            document.querySelectorAll('.target-fit-btn').forEach((candidate) => candidate.classList.remove('is-applied'));
            button.classList.add('is-applied');
            button.title = `Limiter Output ${fitted.toFixed(1)} dB 적용됨`;
        };
        button.dataset.fitBound = 'true';
    });
}

if (streamingLimiterFit) {
    streamingLimiterFit.onclick = () => {
        const recommendation = getStreamingFitRecommendation(latestIntegratedLufs);
        if (!recommendation || !recommendation.hasTooLoudTarget) return;
        const fitted = applyLimiterOutputFit(recommendation.output);
        streamingLimiterFit.innerText = 'FITTING';
        streamingLimiterFit.title = `가장 큰 타겟 초과분을 기준으로 Limiter Output ${fitted.toFixed(1)} dB 적용됨`;
        window.setTimeout(() => {
            if (streamingLimiterFit) streamingLimiterFit.innerText = 'AUTO FIT';
        }, 2500);
    };
}

window.addEventListener('limiter-output-change', (event) => {
    updateStreamingLimiterOutput(event.detail);
});
updateStreamingLimiterOutput();
bindStreamingTargetFitButtons();

function resetLoudnessStats() {
    loudnessSamples = [];
    loudnessChartPoints = [];
    loudnessTruePeak = 0;
    loudnessLastSampleAt = 0;
    loudnessEnergySum = 0;
    latestIntegratedLufs = NaN;
    [loudnessMomentary, loudnessShort, loudnessIntegrated, loudnessLra, loudnessPeak].forEach((element) => {
        if (element) element.innerText = '--';
    });
    Object.values(loudnessMeterBars).forEach((bar) => {
        if (!bar) return;
        bar.style.transform = 'scaleX(0)';
        bar.parentElement?.removeAttribute('aria-valuenow');
        bar.parentElement?.removeAttribute('aria-valuetext');
    });
    document.querySelectorAll('.target-row').forEach((row) => {
        const diff = row.querySelector('em');
        const status = row.querySelector('i');
        const fitButton = row.querySelector('.target-fit-btn');
        if (diff) diff.innerText = '--';
        if (status) { status.innerText = 'WAIT'; status.className = ''; }
        if (fitButton) {
            fitButton.disabled = true;
            fitButton.classList.remove('is-applied');
            fitButton.title = 'LUFS 측정 후 사용 가능';
        }
        delete row.dataset.fitOutput;
    });
    if (streamingLimiterFit) {
        streamingLimiterFit.disabled = true;
        streamingLimiterFit.title = 'LUFS 측정 후 사용 가능';
        streamingLimiterFit.innerText = 'AUTO FIT';
    }
    drawLoudnessHistory();
}

function getAnalyserMetrics(analyser) {
    if (!analyser) return { energy: 0, peak: 0 };
    let samples = analyserSampleBuffers.get(analyser);
    if (!samples || samples.length !== analyser.fftSize) {
        samples = new Float32Array(analyser.fftSize);
        analyserSampleBuffers.set(analyser, samples);
    }
    analyser.getFloatTimeDomainData(samples);
    let energy = 0;
    let peak = 0;
    for (const sample of samples) {
        energy += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
    }
    return { energy: energy / Math.max(1, samples.length), peak };
}

function energyToLufs(energy) {
    return energy > 1e-12 ? -0.691 + (10 * Math.log10(energy)) : -Infinity;
}

function meanEnergy(samples) {
    if (!samples.length) return 0;
    return samples.reduce((sum, sample) => sum + sample.energy, 0) / samples.length;
}

function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)))];
}

function displayLoudness(element, value, decimals = 1) {
    if (element) element.innerText = Number.isFinite(value) ? value.toFixed(decimals) : '-∞';
}

function displayLoudnessLevel(bar, value, min, max, unit) {
    if (!bar) return;
    const finiteValue = Number.isFinite(value) ? value : min;
    const ratio = Math.max(0, Math.min(1, (finiteValue - min) / Math.max(0.001, max - min)));
    bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    const meter = bar.parentElement;
    if (!meter) return;
    meter.setAttribute('aria-valuenow', String(Number.isFinite(value) ? Number(value.toFixed(1)) : min));
    meter.setAttribute('aria-valuetext', Number.isFinite(value) ? `${value.toFixed(1)} ${unit}` : `-infinity ${unit}`);
}

function updateStreamingTargets(integrated) {
    latestIntegratedLufs = Number(integrated);
    updateStreamingLimiterOutput();
    const recommendation = getStreamingFitRecommendation(latestIntegratedLufs);
    const isFitHolding = performance.now() < streamingFitHoldUntil;
    if (streamingLimiterFit) {
        streamingLimiterFit.disabled = isFitHolding || !recommendation?.hasTooLoudTarget;
        streamingLimiterFit.title = recommendation?.hasTooLoudTarget
            ? `가장 엄격한 타겟 기준으로 Limiter Output ${recommendation.output.toFixed(1)} dB 적용`
            : '현재 스트리밍 타겟 초과 없음';
        if (!isFitHolding) streamingLimiterFit.innerText = 'AUTO FIT';
    }
    document.querySelectorAll('.target-row').forEach((row) => {
        const target = Number(row.dataset.targetLufs);
        const adjustment = target - integrated;
        const diff = row.querySelector('em');
        const status = row.querySelector('i');
        const fitButton = row.querySelector('.target-fit-btn');
        if (!Number.isFinite(integrated)) {
            if (diff) diff.innerText = '--';
            if (status) { status.innerText = 'WAIT'; status.className = ''; }
            if (fitButton) {
                fitButton.disabled = true;
                fitButton.classList.remove('is-applied');
                fitButton.title = 'LUFS 측정 후 사용 가능';
            }
            delete row.dataset.fitOutput;
            if (streamingLimiterFit) {
                streamingLimiterFit.disabled = true;
                streamingLimiterFit.title = 'LUFS 측정 후 사용 가능';
            }
            return;
        }
        const currentOutput = Number(audioState.limiter?.outputGain || 0);
        const fittedOutput = clampLimiterOutput(currentOutput + adjustment);
        row.dataset.fitOutput = String(fittedOutput);
        if (diff) diff.innerText = `${adjustment > 0 ? '+' : ''}${adjustment.toFixed(1)} dB`;
        if (status) {
            const within = Math.abs(adjustment) <= 1;
            status.innerText = within ? 'OK' : adjustment < 0 ? 'TOO LOUD' : 'QUIET';
            status.className = within ? 'is-ok' : adjustment < 0 ? 'is-loud' : 'is-quiet';
        }
        if (fitButton) {
            const isApplied = streamingFitAppliedOutput !== null && Math.abs(fittedOutput - streamingFitAppliedOutput) <= 0.05;
            fitButton.disabled = isFitHolding || Math.abs(adjustment) <= 0.1;
            fitButton.title = `${row.querySelector('span')?.innerText || 'Target'} 기준으로 Limiter Output ${fittedOutput.toFixed(1)} dB 적용`;
            if (isFitHolding) fitButton.title = 'Limiter Output 반영 중입니다';
            fitButton.classList.toggle('is-applied', isFitHolding && isApplied);
        }
    });
}

function drawLoudnessHistory() {
    if (!loudnessHistory) return;
    const rect = loudnessHistory.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(240, Math.round(rect.width * dpr));
    const height = Math.max(110, Math.round(rect.height * dpr));
    if (loudnessHistory.width !== width) loudnessHistory.width = width;
    if (loudnessHistory.height !== height) loudnessHistory.height = height;
    const context = loudnessHistory.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#070c16';
    context.fillRect(0, 0, width, height);
    const pad = 22 * dpr;
    const minDb = -48;
    const maxDb = 0;
    const yOf = (value) => pad + ((maxDb - Math.max(minDb, Math.min(maxDb, value))) / (maxDb - minDb)) * (height - pad * 1.4);
    context.font = `${7 * dpr}px monospace`;
    [-6, -14, -23, -36, -48].forEach((db) => {
        const y = yOf(db);
        context.strokeStyle = db === -14 ? 'rgba(34,197,94,.55)' : 'rgba(100,116,139,.18)';
        context.setLineDash(db === -14 ? [4 * dpr, 3 * dpr] : []);
        context.beginPath(); context.moveTo(pad, y); context.lineTo(width, y); context.stroke();
        context.fillStyle = '#64748b'; context.fillText(String(db), 2 * dpr, y + 2 * dpr);
    });
    context.setLineDash([]);
    const points = loudnessChartPoints.slice(-1200);
    if (points.length < 2) return;
    const drawLine = (key, color) => {
        context.strokeStyle = color;
        context.lineWidth = 1.2 * dpr;
        context.beginPath();
        points.forEach((point, index) => {
            const x = pad + (index / Math.max(1, points.length - 1)) * (width - pad);
            const y = yOf(point[key]);
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.stroke();
    };
    drawLine('momentary', '#f97316');
    drawLine('shortTerm', '#22c55e');
    drawLine('integrated', '#38bdf8');
}

function updateMasterLoudnessMeter() {
    const current = originalBuffer && audioCtx ? Math.max(0, Math.min(originalBuffer.duration, isPlaying ? audioCtx.currentTime - startTime : pausedAt)) : 0;
    if (loudnessTime) loudnessTime.innerText = formatTime(current);
    const now = performance.now();
    if (!isPlaying || !levelLeftAnalyser || !levelRightAnalyser || now - loudnessLastSampleAt < 100) return;
    loudnessLastSampleAt = now;
    const left = getAnalyserMetrics(levelLeftAnalyser);
    const right = getAnalyserMetrics(levelRightAnalyser);
    const energy = (left.energy + right.energy) / 2;
    loudnessTruePeak = Math.max(loudnessTruePeak, left.peak, right.peak);
    loudnessSamples.push({ time: now, energy });
    loudnessEnergySum += energy;
    if (loudnessSamples.length > 108000) {
        const removed = loudnessSamples.shift();
        loudnessEnergySum -= removed.energy;
    }
    const recentSamples = (windowMs) => {
        const result = [];
        for (let index = loudnessSamples.length - 1; index >= 0; index--) {
            const sample = loudnessSamples[index];
            if (now - sample.time > windowMs) break;
            result.push(sample);
        }
        return result;
    };
    const momentarySamples = recentSamples(400);
    const shortSamples = recentSamples(3000);
    const momentary = energyToLufs(meanEnergy(momentarySamples));
    const shortTerm = energyToLufs(meanEnergy(shortSamples));
    const integrated = energyToLufs(loudnessEnergySum / Math.max(1, loudnessSamples.length));
    latestIntegratedLufs = integrated;
    const shortValues = loudnessChartPoints.map((point) => point.shortTerm).filter(Number.isFinite);
    const lra = shortValues.length >= 10 ? Math.max(0, percentile(shortValues, 0.95) - percentile(shortValues, 0.10)) : 0;
    const peakDb = loudnessTruePeak > 0 ? 20 * Math.log10(loudnessTruePeak) : -Infinity;
    displayLoudness(loudnessMomentary, momentary);
    displayLoudness(loudnessShort, shortTerm);
    displayLoudness(loudnessIntegrated, integrated);
    displayLoudness(loudnessLra, lra);
    displayLoudness(loudnessPeak, peakDb);
    displayLoudnessLevel(loudnessMeterBars.momentary, momentary, -60, 0, 'LUFS');
    displayLoudnessLevel(loudnessMeterBars.shortTerm, shortTerm, -60, 0, 'LUFS');
    displayLoudnessLevel(loudnessMeterBars.integrated, integrated, -60, 0, 'LUFS');
    displayLoudnessLevel(loudnessMeterBars.lra, lra, 0, 20, 'LU');
    displayLoudnessLevel(loudnessMeterBars.peak, peakDb, -60, 3, 'dBTP');
    loudnessChartPoints.push({ momentary, shortTerm, integrated });
    if (loudnessChartPoints.length > 1200) loudnessChartPoints.shift();
    updateStreamingTargets(integrated);
    drawLoudnessHistory();
}

if (loudnessResetBtn) loudnessResetBtn.onclick = resetLoudnessStats;
if (loudnessHistoryCard && loudnessHistoryResizer) {
    try {
        const storedHeight = Number(localStorage.getItem(LOUDNESS_HISTORY_HEIGHT_KEY));
        if (Number.isFinite(storedHeight) && storedHeight >= 192 && storedHeight <= 672) {
            loudnessHistoryCard.style.height = `${storedHeight}px`;
        }
    } catch (error) {}

    let resizeStartY = 0;
    let resizeStartHeight = 0;
    const finishHistoryResize = (event) => {
        if (!loudnessHistoryResizer.classList.contains('is-resizing')) return;
        loudnessHistoryResizer.classList.remove('is-resizing');
        if (loudnessHistoryResizer.hasPointerCapture?.(event.pointerId)) {
            loudnessHistoryResizer.releasePointerCapture(event.pointerId);
        }
        try { localStorage.setItem(LOUDNESS_HISTORY_HEIGHT_KEY, String(Math.round(loudnessHistoryCard.getBoundingClientRect().height))); } catch (error) {}
    };
    loudnessHistoryResizer.onpointerdown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        resizeStartY = event.clientY;
        resizeStartHeight = loudnessHistoryCard.getBoundingClientRect().height;
        loudnessHistoryResizer.classList.add('is-resizing');
        loudnessHistoryResizer.setPointerCapture?.(event.pointerId);
    };
    loudnessHistoryResizer.onpointermove = (event) => {
        if (!loudnessHistoryResizer.classList.contains('is-resizing')) return;
        const nextHeight = Math.max(192, Math.min(672, resizeStartHeight + (event.clientY - resizeStartY)));
        loudnessHistoryCard.style.height = `${nextHeight}px`;
        drawLoudnessHistory();
    };
    loudnessHistoryResizer.onpointerup = finishHistoryResize;
    loudnessHistoryResizer.onpointercancel = finishHistoryResize;
}
if (loudnessCollapseBtn && loudnessPanelContent) {
    // Loudness metering is a primary monitor, so every fresh page starts expanded.
    loudnessPanelContent.classList.remove('is-collapsed');
    loudnessCollapseBtn.setAttribute('aria-expanded', 'true');
    loudnessCollapseBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    loudnessCollapseBtn.onclick = () => {
        const collapsed = !loudnessPanelContent.classList.contains('is-collapsed');
        loudnessPanelContent.classList.toggle('is-collapsed', collapsed);
        loudnessCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
        loudnessCollapseBtn.innerHTML = `<i class="fa-solid fa-chevron-${collapsed ? 'down' : 'up'}"></i>`;
        if (!collapsed) drawLoudnessHistory();
    };
}
resetLoudnessStats();

// Bind file selection and drag-and-drop before the rest of the workstation UI initializes.
// This keeps uploading operational even if an unrelated panel fails later during startup.
const audioUploadController = initAudioUpload({
    input: upload,
    getAudioContext: async () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // Decoding works while suspended. Do not await resume here: file change/drop
        // is not always accepted as an autoplay gesture and the promise may stay pending.
        if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
        return audioCtx;
    },
    onLoading: (file) => {
        resetLoudnessStats();
        startWaveformLoading(file);
        trackName.innerText = `${file.name} 웨이브폼 불러오는 중...`;
        detectorStatus.innerText = '(분석 연산 중)';
    },
    onDecoded: async ({ file, buffer, batchIndex = 0, batchTotal = 1 }) => {
        await completeDecodedAudioWithLoading(file, buffer, { batchIndex, batchTotal });
        await window.jjimHandoff?.registerAudioFile(file);
    },
    onAnalysis: ({ file, waveformPeaks: analysedPeaks }) => {
        const clip = audioTimelineClips.find(candidate => candidate.file === file);
        if (clip) clip.waveformPeaks = analysedPeaks;
        if (audioTimelineClips.length === 1 && clip === audioTimelineClips[0]) {
            waveformPeaks = analysedPeaks;
            drawAudioWaveform(waveformProgress);
        }
    },
    onError: (error) => {
        stopWaveformLoading(false, error?.message || '파일 로드 실패');
        console.error('Audio upload failed:', error);
        alert(error.message || '오디오 데이터 디코딩에 실패했습니다. 포맷을 다시 확인해 주세요.');
    }
});
// JJaIMsae Player desktop bridge: receive each selected track exactly once.
// Both the page and the native page-load hook may request an import, so share
// one in-flight promise and acknowledge the handoff only after decode succeeds.
let masteringImportPromise = null;
window.importPendingMasteringTrack = function importPendingMasteringTrack() {
  if (masteringImportPromise) return masteringImportPromise;
  masteringImportPromise = (async () => {
   try {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return;
    const track = await invoke('peek_pending_mastering');
    if (!track?.path) return;
    const ext = (track.format || 'wav').toLowerCase();
    const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'webm' ? 'audio/webm' : 'audio/mp4';
    let blob;
    const convertFileSrc = window.__TAURI__?.core?.convertFileSrc;
    if (convertFileSrc) {
        try {
            const response = await fetch(convertFileSrc(track.path));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            blob = await response.blob();
        } catch (assetError) {
            console.warn('Asset protocol read failed; using IPC fallback.', assetError);
        }
    }
    if (!blob?.size) {
        const bytes = await invoke('read_binary', { path: track.path });
        blob = new Blob([new Uint8Array(bytes)], { type: mime });
    }
    const file = new File([blob], track.name || `source.${ext}`, { type: mime || blob.type });
    const imported = await audioUploadController.importFile(file);
    if (!imported) throw new Error('음원 디코딩을 완료하지 못했습니다.');
    window.__PLAYER_MASTERING_SOURCE_SRT__ = track.srt_path || '';
    if (track.srt_path) {
        const srtText = await invoke('read_text', { path: track.srt_path });
        const srtName = String(track.srt_path).split(/[\\/]/).pop() || 'lyrics.srt';
        const srtFile = new File([srtText], srtName, { type: 'application/x-subrip' });
        await window.jjimHandoff?.registerLyricsFile(srtFile);
    }
    await invoke('clear_pending_mastering');
   } catch (error) {
    console.error('JJaIMsae Player handoff failed', error);
    alert(`JJaIMsae Player에서 곡을 불러오지 못했습니다.\n${error?.message || error}`);
   } finally {
    masteringImportPromise = null;
   }
  })();
  return masteringImportPromise;
};
window.importPendingMasteringTrack();

function stopMasteringPlayback() {
    stopCurrentAudioSource(false);
    try { audioCtx?.suspend(); } catch (error) {}
}
window.stopMasteringPlayback = stopMasteringPlayback;
window.addEventListener('pagehide', stopMasteringPlayback);
window.addEventListener('beforeunload', stopMasteringPlayback);

document.getElementById('close-mastering-btn')?.addEventListener('click', async () => {
    stopMasteringPlayback();
    if (window.parent !== window) {
        window.parent.postMessage({ type: 'jjaimsae-close-mastering' }, '*');
        return;
    }
    window.close();
});


window.addEventListener('jjim-audio-restore', async event => {
    const file = event.detail?.file;
    if (originalBuffer || restoringPersistedAudio || !(file instanceof Blob) || !file.size) return;
    restoringPersistedAudio = true;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        startWaveformLoading(file);
        const encoded = await file.arrayBuffer();
        const buffer = await audioCtx.decodeAudioData(encoded.slice(0));
        audioTimelineClips = [createTimelineClip(file, buffer)];
        activeTimelineClipIndex = 0;
        applyDecodedAudioState(file, buffer, { mode: 'replace', resumeAt: 0, resumePlayback: false });
        waveformPeaks = buildWaveformPeaks(buffer);
        audioTimelineClips[0].waveformPeaks = waveformPeaks;
        drawAudioWaveform(0);
        showWaveformLoadMessage(`${file.name} 파형 복원 완료`, true);
    } catch (error) {
        stopWaveformLoading(false, '저장된 원곡 파형 복원 실패');
        console.error('Persisted audio restore failed:', error);
    } finally {
        restoringPersistedAudio = false;
    }
});

function setProgressBarValue(value) {
    const clampedValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    if (progressBar) {
        progressBar.value = clampedValue;
        progressBar.style.setProperty('--playback-progress', `${clampedValue}%`);
        const duration = originalBuffer?.duration || 0;
        const current = duration * (clampedValue / 100);
        progressBar.setAttribute('aria-valuetext', `${formatTime(current)} / ${formatTime(duration)}`);
    }
    if (progressPercent) progressPercent.innerText = formatTime(originalBuffer?.duration || 0);
}

let activeExportJob = null;

function setExportProgress(value, statusText) {
    const clampedValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    if (exportProgressFill) exportProgressFill.style.width = `${clampedValue}%`;
    if (exportProgressText) exportProgressText.innerText = `${Math.round(clampedValue)}%`;
    if (exportStatusText && statusText) exportStatusText.innerText = statusText;
}

function showExportProgress(statusText = 'WAV 내보내기 준비 중') {
    if (exportProgressPanel) exportProgressPanel.classList.remove('hidden');
    if (exportCancelBtn) exportCancelBtn.disabled = false;
    setExportProgress(0, statusText);
}

function hideExportProgress(delay = 0) {
    window.setTimeout(() => {
        if (exportProgressPanel) exportProgressPanel.classList.add('hidden');
        setExportProgress(0, 'WAV 내보내기 준비 중');
    }, delay);
}

function setDownloadButtonEnabled(enabled) {
    if (downloadBtn) downloadBtn.disabled = !enabled;
    if (audioDownloadBtn) audioDownloadBtn.disabled = !enabled;
}

// Helper to check play/bypass states in effectors
const getPlayState = () => isPlaying;
const getBypassState = () => isBypassed;

// UI 1: 20-band EQ renderer and response visualizer
eq.renderUI('eq-sliders-container');
eq.initVisualizer('eq-response-canvas');
eq.startVisualizer();

// UI 2: 20채널 스마트 믹서 사전 장착
const matrixContainer = document.getElementById('stems-matrix-container');
function buildInitialStemMatrixUI() {
    matrixContainer.innerHTML = "";
    stemRegistry.forEach((stem) => {
        const card = document.createElement('div');
        card.id = `card-${stem.id}`;
        card.className = "bg-[#090d16]/50 p-2 rounded-xl border border-gray-900 flex flex-col space-y-1 opacity-20 pointer-events-none select-none transition-all";
        card.innerHTML = `
            <div class="flex justify-between items-center text-xs font-medium">
                <span class="text-gray-600 truncate max-w-[70%]" id="title-${stem.id}"><i class="fa-solid fa-lock mr-1.5"></i>${stem.name}</span>
                <div class="flex items-center gap-1">
                    <button id="mute-${stem.id}" class="bg-gray-800 text-gray-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-gray-700 hover:bg-gray-700 transition" disabled>M</button>
                    <span id="val-${stem.id}" class="font-mono text-gray-700 text-[10px]">Disabled</span>
                </div>
            </div>
            <input type="range" id="input-${stem.id}" min="-20" max="8" value="0" step="0.5" class="w-full h-1 bg-gray-950 rounded appearance-none" disabled>
        `;
        matrixContainer.appendChild(card);
    });
}
buildInitialStemMatrixUI();

// UI 3: 100가지 스타일 라이브러리 드로우
const genreGrid = document.getElementById('genre-grid');

// "선택 안 함" (None) 버튼 추가
const noneBtn = document.createElement('button');
noneBtn.className = `preset-btn genre-active`;
noneBtn.innerHTML = `<span class="preset-num">-</span>선택 안 함 (Flat)`;
noneBtn.onclick = () => {
    document.querySelectorAll('#genre-grid button').forEach(b => b.classList.remove('genre-active'));
    noneBtn.classList.add('genre-active');
    audioState.eqEnabled = false;
    activeMicroPresetIndex = null;
    
    eq.frequencies.forEach((_, idx) => {
        eq.setEQValue(idx, 0, audioCtx, getPlayState, getBypassState, false);
    });
    eq.updateUI();
    if (audioCtx && isPlaying) eq.applySettings(audioCtx, getBypassState());
};
genreGrid.appendChild(noneBtn);

function buildMicroMasterPreset(name, presetIndex) {
    const valueAt = (idx) => {
        const freq = eq.frequencies[idx] || 1000;
        const logFreq = Math.log10(freq);
        const gaussian = (center, width, gain) => gain * Math.exp(-0.5 * Math.pow((logFreq - Math.log10(center)) / width, 2));
        let value = 0;

        if (name.includes("Low Shelf +")) value += gaussian(65, 0.42, name.includes("+0.5") ? 0.5 : 0.3);
        if (name.includes("Low Shelf -") || name.includes("Low Trim")) value -= gaussian(75, 0.42, name.includes("-0.5") ? 0.5 : 0.3);
        if (name.includes("Sub Clean") || name.includes("Sub Guard")) value -= gaussian(35, 0.28, 0.45);
        if (name.includes("Kick Weight")) value += gaussian(85, 0.25, 0.4);
        if (name.includes("Kick Seat")) value += gaussian(95, 0.23, 0.28);
        if (name.includes("Low Tight") || name.includes("Low Guard") || name.includes("Low Control")) value -= gaussian(180, 0.35, 0.35);
        if (name.includes("Mud Trim") || name.includes("Mud Cut") || name.includes("Mud -")) value -= gaussian(280, 0.28, name.includes("-0.7") ? 0.7 : 0.42);
        if (name.includes("Low-Mid Body") || name.includes("Body +") || name.includes("Body Small")) value += gaussian(220, 0.28, name.includes("-0.3") ? -0.3 : 0.32);
        if (name.includes("Box Trim") || name.includes("Box -")) value -= gaussian(480, 0.22, name.includes("-0.6") ? 0.6 : 0.38);
        if (name.includes("Center Clarity") || name.includes("Mid Clean") || name.includes("Clean Translation")) value += gaussian(1200, 0.28, 0.28);
        if (name.includes("Vocal Pocket") || name.includes("Vocal Clear") || name.includes("Presence +") || name.includes("Presence Small") || name.includes("Presence +0.4")) value += gaussian(2600, 0.25, name.includes("+0.5") ? 0.5 : 0.34);
        if (name.includes("Presence Trim") || name.includes("Harsh") || name.includes("Bite Trim") || name.includes("Bright Tame") || name.includes("Edge Tame")) value -= gaussian(3400, 0.24, name.includes("-0.5") ? 0.5 : 0.34);
        if (name.includes("Sibilance") || name.includes("Hi-Hat Soft")) value -= gaussian(6500, 0.22, name.includes("-0.5") ? 0.5 : 0.38);
        if (name.includes("Air +") || name.includes("String Air") || name.includes("Vocal Air") || name.includes("Laptop")) value += gaussian(11000, 0.3, name.includes("+0.6") ? 0.6 : 0.42);
        if (name.includes("Air -") || name.includes("Top Smooth") || name.includes("Soft Top") || name.includes("Air Soft")) value -= gaussian(11000, 0.32, name.includes("-0.6") ? 0.6 : 0.34);
        if (name.includes("Warm Tilt") || name.includes("Warm Micro") || name.includes("Tube Warm")) value += gaussian(160, 0.42, 0.28) - gaussian(9000, 0.42, 0.2);
        if (name.includes("Cool Tilt") || name.includes("Bright A")) value -= gaussian(170, 0.42, 0.22) + gaussian(9000, 0.42, 0.32);
        if (name.includes("Dense Trim") || name.includes("Translation") || name.includes("Mono Safe")) value -= gaussian(250, 0.3, 0.18) + gaussian(4200, 0.28, 0.15);

        const microVariation = Math.sin((presetIndex + 1) * 0.71 + idx * 0.83) * 0.08;
        const shaped = Math.max(-1.35, Math.min(1.35, value + microVariation)) * aiMicroPresetScale;
        return Math.round(shaped * 100) / 100;
    };
    return eq.frequencies.map((_, idx) => valueAt(idx));
}

presetNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = `preset-btn`;
    btn.innerHTML = `<span class="preset-num">${i+1}.</span>${name}`;
    btn.onclick = () => {
        document.querySelectorAll('#genre-grid button').forEach(b => b.classList.remove('genre-active'));
        btn.classList.add('genre-active');
        audioState.eqEnabled = true;
        activeMicroPresetIndex = i;
        const presetValues = buildMicroMasterPreset(name, i);
        presetValues.forEach((value, idx) => {
            eq.setEQValue(idx, value, audioCtx, getPlayState, getBypassState, false);
        });
        eq.updateUI();
        if (audioCtx && isPlaying) eq.applySettings(audioCtx, getBypassState());
    };
    genreGrid.appendChild(btn);
});

// Exciter curve shaper
function makeExciterCurve(amount) {
    let n_samples = 44100;
    let curve = new Float32Array(n_samples);
    let blend = (amount / 100) * 0.4; 
    for (let i = 0; i < n_samples; ++i) {
        let x = (i * 2) / n_samples - 1;
        if (blend === 0) {
            curve[i] = x;
        } else {
            curve[i] = x + blend * Math.sin(x * Math.PI * 0.5);
        }
    }
    return curve;
}

function applyUtilityEffectSettings(context) {
    if (!context) return;
    const noiseVal = (!isBypassed && audioState.noiseEnabled) ? audioState.noise : 0;
    const deesserVal = (!isBypassed && audioState.deesserEnabled) ? audioState.deesser : 0;
    const saturatorVal = (!isBypassed && audioState.saturatorEnabled) ? audioState.saturator : 0;

    if (noiseFilters.lowCut) noiseFilters.lowCut.frequency.setValueAtTime(10 + (noiseVal * 1.2), context.currentTime);
    if (noiseFilters.highCut) noiseFilters.highCut.frequency.setValueAtTime(22000 - (noiseVal * 120), context.currentTime);
    if (noiseFilters.deEsser) noiseFilters.deEsser.gain.setValueAtTime(- (deesserVal / 100) * 12, context.currentTime);
    if (noiseFilters.waveShaper) noiseFilters.waveShaper.curve = makeExciterCurve(saturatorVal);
}

function formatTime(t) {
    return String(Math.floor(t / 60)).padStart(2,'0') + ':' + String(Math.floor(t % 60)).padStart(2,'0');
}

function createLoadingWaveformPeaks(fileName, bucketCount = 900) {
    let seed = Array.from(String(fileName || 'audio')).reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
    const random = () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    return Array.from({ length: bucketCount }, (_, index) => {
        const position = index / Math.max(1, bucketCount - 1);
        const envelope = 0.42 + (0.25 * Math.sin(position * Math.PI * 5.4)) + (0.13 * Math.sin(position * Math.PI * 17));
        return Math.max(0.08, Math.min(0.95, envelope + (random() - 0.5) * 0.22));
    });
}

function showWaveformLoadMessage(message, done = false) {
    if (!waveformLoadMessage) return;
    window.clearTimeout(waveformMessageTimer);
    waveformLoadMessage.classList.remove('hidden');
    waveformLoadMessage.classList.toggle('is-done', done);
    const icon = document.createElement('i');
    icon.className = done ? 'fa-solid fa-circle-check' : 'fa-solid fa-wave-square fa-beat-fade';
    const text = document.createElement('span');
    text.textContent = message;
    waveformLoadMessage.replaceChildren(icon, text);
    if (done) {
        waveformMessageTimer = window.setTimeout(() => waveformLoadMessage.classList.add('hidden'), 2800);
    }
}

function startWaveformLoading(file) {
    if (waveformLoadingFrame) cancelAnimationFrame(waveformLoadingFrame);
    const state = {
        fileName: file?.name || '새 오디오 파일',
        startedAt: performance.now(),
        progress: 0,
        pulse: 0,
        peaks: createLoadingWaveformPeaks(file?.name)
    };
    waveformLoadingState = state;
    waveformProgress = 0;
    if (waveformTime) waveformTime.innerText = 'LOADING WAVEFORM...';
    showWaveformLoadMessage(`${state.fileName} 불러오는 중...`);
    const animate = (now) => {
        if (waveformLoadingState !== state) return;
        const elapsed = Math.max(0, now - state.startedAt);
        state.progress = Math.min(0.94, 1 - Math.exp(-elapsed / 720));
        state.pulse = elapsed / 1000;
        drawAudioWaveform(0);
        waveformLoadingFrame = requestAnimationFrame(animate);
    };
    waveformLoadingFrame = requestAnimationFrame(animate);
}

function stopWaveformLoading(done = false, message = '') {
    if (waveformLoadingFrame) cancelAnimationFrame(waveformLoadingFrame);
    waveformLoadingFrame = 0;
    waveformLoadingState = null;
    if (message) showWaveformLoadMessage(message, done);
    drawAudioWaveform(waveformProgress);
}

function completeDecodedAudioWithLoading(file, buffer, options = {}) {
    const loadingState = waveformLoadingState;
    return new Promise((resolve) => {
        queueMicrotask(() => {
            if (loadingState && waveformLoadingState !== loadingState) {
                resolve();
                return;
            }
            void handleDecodedAudio(file, buffer, options)
                .catch((error) => {
                    stopWaveformLoading(false, error?.message || '파일 로드 실패');
                    console.error('Audio timeline upload failed:', error);
                })
                .finally(resolve);
        });
    });
}

function buildWaveformPeaks(buffer, bucketCount = 2048) {
    if (!buffer) return [];

    const channelCount = buffer.numberOfChannels;
    const sampleCount = buffer.length;
    const preciseBucketCount = Math.min(8192, Math.max(2048, bucketCount, Math.ceil(buffer.duration * 32)));
    const channels = Array.from({ length: channelCount }, (_, channelIndex) => {
        const data = buffer.getChannelData(channelIndex);
        const min = new Array(preciseBucketCount).fill(0);
        const max = new Array(preciseBucketCount).fill(0);
        for (let bucket = 0; bucket < preciseBucketCount; bucket++) {
            const start = Math.floor((bucket / preciseBucketCount) * sampleCount);
            const end = Math.max(start + 1, Math.floor(((bucket + 1) / preciseBucketCount) * sampleCount));
            let low = 1;
            let high = -1;
            for (let sample = start; sample < Math.min(sampleCount, end); sample++) {
                const value = data[sample];
                if (value < low) low = value;
                if (value > high) high = value;
            }
            min[bucket] = low <= high ? low : 0;
            max[bucket] = low <= high ? high : 0;
        }
        return { min, max };
    });
    return { version: 2, bucketCount: preciseBucketCount, channelCount, channels };
}

function buildWaveformPreview(buffer, bucketCount = 2048, samplesPerBucket = 128) {
    if (!buffer) return [];
    const channelCount = buffer.numberOfChannels;
    const sampleCount = buffer.length;
    const previewBucketCount = Math.min(4096, Math.max(1024, bucketCount, Math.ceil(buffer.duration * 16)));
    const channels = Array.from({ length: channelCount }, (_, channelIndex) => {
        const data = buffer.getChannelData(channelIndex);
        const min = new Array(previewBucketCount).fill(0);
        const max = new Array(previewBucketCount).fill(0);
        for (let bucket = 0; bucket < previewBucketCount; bucket++) {
            const start = Math.floor((bucket / previewBucketCount) * sampleCount);
            const end = Math.max(start + 1, Math.floor(((bucket + 1) / previewBucketCount) * sampleCount));
            const stride = Math.max(1, Math.floor((end - start) / samplesPerBucket));
            let low = 1;
            let high = -1;
            for (let sample = start; sample < Math.min(sampleCount, end); sample += stride) {
                const value = data[sample];
                if (value < low) low = value;
                if (value > high) high = value;
            }
            const lastValue = data[Math.min(sampleCount - 1, end - 1)] || 0;
            if (lastValue < low) low = lastValue;
            if (lastValue > high) high = lastValue;
            min[bucket] = low <= high ? low : 0;
            max[bucket] = low <= high ? high : 0;
        }
        return { min, max };
    });
    return { version: 2, preview: true, bucketCount: previewBucketCount, channelCount, channels };
}

function hasWaveformEnvelope(value) {
    return Boolean(value?.channels?.length && value.channels.some(channel => channel?.min?.length && channel?.max?.length));
}

function drawWaveformEnvelope(ctx, envelope, width, laneTop, laneHeight, color, clipLeft, clipRight, strokeColor = '', lineWidth = 1) {
    const mins = envelope?.min || [];
    const maxs = envelope?.max || [];
    const bucketCount = Math.min(mins.length, maxs.length);
    if (!bucketCount || clipRight <= clipLeft) return;
    const centerY = laneTop + laneHeight / 2;
    const amplitude = laneHeight * 0.43;
    const pointCount = Math.max(2, Math.min(bucketCount, Math.ceil(width)));
    const topPoints = [];
    const bottomPoints = [];
    for (let point = 0; point < pointCount; point++) {
        const ratio = point / Math.max(1, pointCount - 1);
        const bucketStart = Math.min(bucketCount - 1, Math.floor(ratio * bucketCount));
        const nextRatio = (point + 1) / Math.max(1, pointCount - 1);
        const bucketEnd = Math.max(bucketStart + 1, Math.min(bucketCount, Math.ceil(nextRatio * bucketCount)));
        let low = 1;
        let high = -1;
        for (let bucket = bucketStart; bucket < bucketEnd; bucket++) {
            if (mins[bucket] < low) low = mins[bucket];
            if (maxs[bucket] > high) high = maxs[bucket];
        }
        if (low > high) low = high = 0;
        const x = ratio * width;
        topPoints.push([x, centerY - high * amplitude]);
        bottomPoints.push([x, centerY - low * amplitude]);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipLeft, laneTop, clipRight - clipLeft, laneHeight);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(topPoints[0][0], topPoints[0][1]);
    for (let index = 1; index < topPoints.length; index++) ctx.lineTo(topPoints[index][0], topPoints[index][1]);
    for (let index = bottomPoints.length - 1; index >= 0; index--) ctx.lineTo(bottomPoints[index][0], bottomPoints[index][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    ctx.restore();
}

function applyMasterAmplitudeCurve(value) {
    if (!Number.isFinite(value) || value === 0) return 0;
    const sign = Math.sign(value);
    let amplitude = Math.min(1, Math.abs(value));

    if (audioState.saturatorEnabled && audioState.saturator > 0) {
        const amount = Math.max(0, Number(audioState.saturator) || 0) / 100;
        const drive = 1 + amount * 3;
        amplitude = Math.tanh(amplitude * drive) / Math.tanh(drive);
    }
    if (audioState.masterSaturation?.enabled) {
        const mix = Math.max(0, Math.min(1, Number(audioState.masterSaturation.mix) / 100 || 0));
        const drive = Math.max(1, 1 + (Number(audioState.masterSaturation.drive) || 0) * 0.35);
        const saturated = Math.tanh(amplitude * drive) / Math.tanh(drive);
        amplitude = amplitude * (1 - mix) + saturated * mix;
        amplitude *= Math.pow(10, (Number(audioState.masterSaturation.output) || 0) / 20);
    }

    let levelDb = 20 * Math.log10(Math.max(1e-7, amplitude));
    if (audioState.compressor?.enabled) {
        levelDb += Number(audioState.compressor.inputGain) || 0;
        const threshold = Number(audioState.compressor.threshold) || -24;
        const ratio = Math.max(1, Number(audioState.compressor.ratio) || 1);
        if (levelDb > threshold) levelDb = threshold + (levelDb - threshold) / ratio;
        levelDb += Number(audioState.compressor.makeup) || 0;
    }
    if (audioState.limiter?.enabled) {
        const threshold = Number(audioState.limiter.threshold) || -1;
        if (levelDb > threshold) levelDb = threshold + (levelDb - threshold) * 0.035;
        levelDb += Number(audioState.limiter.outputGain) || 0;
    }
    amplitude = Math.pow(10, levelDb / 20) * Math.max(0, Number(audioState.master) || 0) / 100;
    return sign * Math.min(1, amplitude);
}

function createMasteredWaveformEnvelope(envelope) {
    const signature = [
        audioState.saturatorEnabled, audioState.saturator,
        audioState.masterSaturation?.enabled, audioState.masterSaturation?.drive,
        audioState.masterSaturation?.mix, audioState.masterSaturation?.output,
        audioState.compressor?.enabled, audioState.compressor?.inputGain,
        audioState.compressor?.threshold, audioState.compressor?.ratio, audioState.compressor?.makeup,
        audioState.limiter?.enabled, audioState.limiter?.threshold, audioState.limiter?.outputGain,
        audioState.master
    ].join('|');
    const cached = masteredWaveformCache.get(envelope);
    if (cached?.signature === signature) return cached.envelope;
    const masteredEnvelope = {
        min: Array.from(envelope?.min || [], value => applyMasterAmplitudeCurve(value)),
        max: Array.from(envelope?.max || [], value => applyMasterAmplitudeCurve(value))
    };
    masteredWaveformCache.set(envelope, { signature, envelope: masteredEnvelope });
    return masteredEnvelope;
}

function createCoveringWaveformEnvelope(rawEnvelope, masteredEnvelope) {
    if (!rawEnvelope || !masteredEnvelope) return masteredEnvelope || rawEnvelope;

    let rawCache = coveringWaveformCache.get(masteredEnvelope);
    if (!rawCache) {
        rawCache = new WeakMap();
        coveringWaveformCache.set(masteredEnvelope, rawCache);
    }
    const cached = rawCache.get(rawEnvelope);
    if (cached) return cached;

    const rawMins = rawEnvelope.min || [];
    const rawMaxs = rawEnvelope.max || [];
    const masterMins = masteredEnvelope.min || [];
    const masterMaxs = masteredEnvelope.max || [];
    const rawBucketCount = Math.min(rawMins.length, rawMaxs.length);
    const masterBucketCount = Math.min(masterMins.length, masterMaxs.length);
    const bucketCount = rawBucketCount || masterBucketCount;
    if (!bucketCount) return masteredEnvelope;

    const sampleRange = (values, index, pick) => {
        if (!values.length) return 0;
        const start = Math.min(values.length - 1, Math.floor((index / bucketCount) * values.length));
        const end = Math.max(start + 1, Math.min(values.length, Math.ceil(((index + 1) / bucketCount) * values.length)));
        let sampled = Number(values[start]) || 0;
        for (let sourceIndex = start + 1; sourceIndex < end; sourceIndex++) {
            sampled = pick(sampled, Number(values[sourceIndex]) || 0);
        }
        return sampled;
    };
    const min = new Array(bucketCount);
    const max = new Array(bucketCount);
    for (let index = 0; index < bucketCount; index++) {
        min[index] = Math.min(sampleRange(rawMins, index, Math.min), sampleRange(masterMins, index, Math.min));
        max[index] = Math.max(sampleRange(rawMaxs, index, Math.max), sampleRange(masterMaxs, index, Math.max));
    }

    const coveringEnvelope = { min, max };
    rawCache.set(rawEnvelope, coveringEnvelope);
    return coveringEnvelope;
}

function scheduleWaveformRedraw() {
    if (waveformRedrawFrame) return;
    waveformRedrawFrame = requestAnimationFrame(() => {
        waveformRedrawFrame = 0;
        drawAudioWaveform(waveformProgress);
    });
}

function drawAudioWaveform(progress = waveformProgress) {
    if (!waveformCanvas || !waveformCtx) return;

    const channelCount = hasWaveformEnvelope(waveformPeaks) ? Math.min(2, waveformPeaks.channels.length) : 1;
    const channelLabel = channelCount > 1 ? '스테레오 오디오 파형, 위 왼쪽 채널, 아래 오른쪽 채널' : '모노 오디오 파형';
    const masterComparisonLabel = isBypassed ? '' : hasWaveformEnvelope(masteredWaveformPeaks)
        ? ', 원본과 실제 마스터 WAV 파형 겹쳐 보기'
        : ', 원본과 마스터 예상 파형 겹쳐 보기';
    waveformCanvas.setAttribute('aria-label', `${channelLabel}${masterComparisonLabel}`);
    const desiredCssHeight = channelCount > 1 ? 168 : 124;
    if (!waveformLoadingState && waveformCanvas.style.height !== `${desiredCssHeight}px`) {
        waveformCanvas.style.height = `${desiredCssHeight}px`;
    }
    const rect = waveformCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (waveformCanvas.width !== width || waveformCanvas.height !== height) {
        waveformCanvas.width = width;
        waveformCanvas.height = height;
    }

    const ctx2 = waveformCtx;
    const isLight = document.body.classList.contains('light-mode');
    const bg = isLight ? '#eef3f8' : '#03050a';
    const grid = isLight ? 'rgba(71, 85, 105, 0.18)' : 'rgba(148, 163, 184, 0.12)';
    const idle = isLight ? '#94a3b8' : '#334155';
    const played = isLight ? '#0284c7' : '#22d3ee';
    ctx2.clearRect(0, 0, width, height);
    ctx2.fillStyle = bg;
    ctx2.fillRect(0, 0, width, height);

    ctx2.strokeStyle = grid;
    ctx2.lineWidth = 1 * dpr;
    for (let x = 0; x <= width; x += width / 12) {
        ctx2.beginPath();
        ctx2.moveTo(x, 0);
        ctx2.lineTo(x, height);
        ctx2.stroke();
    }
    for (let y = 0; y <= height; y += height / 4) {
        ctx2.beginPath();
        ctx2.moveTo(0, y);
        ctx2.lineTo(width, y);
        ctx2.stroke();
    }

    const loading = waveformLoadingState;
    const playX = Math.max(0, Math.min(width, (loading ? loading.progress : progress) * width));

    if (loading) {
        const peaks = loading.peaks || new Array(180).fill(0.02);
        const barCount = Math.min(peaks.length, Math.max(1, Math.floor(width / (3 * dpr))));
        const step = peaks.length / barCount;
        const barW = Math.max(1 * dpr, width / barCount - dpr);
        const centerY = height / 2;
        for (let i = 0; i < barCount; i++) {
            const peak = peaks[Math.floor(i * step)] || 0;
            const x = i * (width / barCount);
            const pulse = 0.9 + (0.1 * Math.sin((i * 0.24) + loading.pulse * 6));
            const barH = Math.max(1.5 * dpr, peak * pulse * (height - 20 * dpr));
            ctx2.fillStyle = x <= playX ? played : idle;
            ctx2.fillRect(x, centerY - barH / 2, barW, barH);
        }
        const scanGradient = ctx2.createLinearGradient(Math.max(0, playX - 80 * dpr), 0, playX, 0);
        scanGradient.addColorStop(0, 'rgba(34,211,238,0)');
        scanGradient.addColorStop(1, 'rgba(34,211,238,.2)');
        ctx2.fillStyle = scanGradient;
        ctx2.fillRect(Math.max(0, playX - 80 * dpr), 0, Math.min(playX, 80 * dpr), height);
        ctx2.strokeStyle = '#22d3ee';
        ctx2.lineWidth = 2 * dpr;
        ctx2.beginPath(); ctx2.moveTo(playX, 0); ctx2.lineTo(playX, height); ctx2.stroke();
        return;
    }

    if (hasWaveformEnvelope(waveformPeaks)) {
        const visibleChannels = waveformPeaks.channels.slice(0, channelCount);
        const showMasterOverlay = !isBypassed;
        const laneGap = channelCount > 1 ? 10 * dpr : 0;
        const laneHeight = (height - laneGap) / channelCount;
        const hasRenderedMaster = hasWaveformEnvelope(masteredWaveformPeaks);
        visibleChannels.forEach((envelope, index) => {
            const laneTop = index * (laneHeight + laneGap);
            const centerY = laneTop + laneHeight / 2;
            ctx2.strokeStyle = isLight ? 'rgba(71,85,105,.35)' : 'rgba(100,116,139,.42)';
            ctx2.lineWidth = dpr;
            ctx2.beginPath();
            ctx2.moveTo(0, centerY);
            ctx2.lineTo(width, centerY);
            ctx2.stroke();
            if (showMasterOverlay) {
                drawWaveformEnvelope(ctx2, envelope, width, laneTop, laneHeight,
                    isLight ? 'rgba(100,116,139,.24)' : 'rgba(100,116,139,.30)', 0, width,
                    isLight ? 'rgba(71,85,105,.42)' : 'rgba(148,163,184,.38)', dpr * 0.7);
                const masteredEnvelope = hasRenderedMaster
                    ? masteredWaveformPeaks.channels[Math.min(index, masteredWaveformPeaks.channels.length - 1)]
                    : createMasteredWaveformEnvelope(envelope);
                const coveringMasterEnvelope = createCoveringWaveformEnvelope(envelope, masteredEnvelope);
                drawWaveformEnvelope(ctx2, coveringMasterEnvelope, width, laneTop, laneHeight,
                    isLight ? 'rgba(124,58,237,.24)' : 'rgba(139,92,246,.30)', 0, width,
                    isLight ? '#7c3aed' : '#c4b5fd', dpr * 1.15);
            } else {
                drawWaveformEnvelope(ctx2, envelope, width, laneTop, laneHeight, idle, playX, width);
                drawWaveformEnvelope(ctx2, envelope, width, laneTop, laneHeight, played, 0, playX);
            }
            ctx2.fillStyle = isLight ? '#475569' : '#64748b';
            ctx2.font = `${9 * dpr}px ui-monospace, monospace`;
            ctx2.fillText(channelCount > 1 ? (index === 0 ? 'L' : 'R') : 'MONO', 6 * dpr, laneTop + 12 * dpr);
        });
        if (showMasterOverlay) {
            ctx2.font = `bold ${9 * dpr}px ui-monospace, monospace`;
            const legendY = 13 * dpr;
            const masterLabel = hasRenderedMaster ? 'MASTER WAV' : 'MASTER';
            const masterLabelWidth = ctx2.measureText(masterLabel).width;
            ctx2.fillStyle = isLight ? '#7c3aed' : '#c4b5fd';
            ctx2.fillText(masterLabel, width - masterLabelWidth - 8 * dpr, legendY);
            ctx2.fillStyle = isLight ? '#64748b' : '#94a3b8';
            ctx2.fillText('RAW', width - masterLabelWidth - 42 * dpr, legendY);
        }
    } else {
        const centerY = height / 2;
        ctx2.strokeStyle = idle;
        ctx2.setLineDash([4 * dpr, 3 * dpr]);
        ctx2.beginPath();
        ctx2.moveTo(0, centerY);
        ctx2.lineTo(width, centerY);
        ctx2.stroke();
        ctx2.setLineDash([]);
    }

    ctx2.fillStyle = isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(34, 211, 238, 0.12)';
    ctx2.fillRect(0, 0, playX, height);

    ctx2.strokeStyle = '#f59e0b';
    ctx2.lineWidth = 2 * dpr;
    ctx2.beginPath();
    ctx2.moveTo(playX, 0);
    ctx2.lineTo(playX, height);
    ctx2.stroke();

}

['input', 'change', 'click'].forEach(eventName => {
    document.addEventListener(eventName, event => {
        const target = event.target;
        const changesMasterSound = target?.matches?.('#master-volume, #noise-reducer, #deesser-reducer, #saturator-volume') ||
            target?.closest?.('#main-master-effects, #eq-panel, #master-saturation-panel, #master-spread-panel');
        if (changesMasterSound) masteredWaveformPeaks = [];
        if (!isBypassed && hasWaveformEnvelope(waveformPeaks)) scheduleWaveformRedraw();
    });
});

function updateWaveformProgress(current = 0) {
    const duration = originalBuffer ? originalBuffer.duration : 0;
    waveformProgress = duration ? Math.max(0, Math.min(1, current / duration)) : 0;
    if (waveformTime) waveformTime.innerText = `${formatTime(current)} / ${formatTime(duration)}`;
    drawAudioWaveform(waveformProgress);
    updateAudioTimelinePlayhead(current);
    updateTimedLyrics(current);
}

function updateLoopButton() {
    if (!loopBtn) return;
    loopBtn.setAttribute('aria-pressed', String(isLooping));
    loopBtn.className = isLooping
        ? "transport-btn is-looping"
        : "transport-btn";
}

function clampSectionTime(value) {
    const duration = originalBuffer?.duration || 0;
    return Math.max(0, Math.min(duration, Number(value) || 0));
}

function setSectionRepeatRange(start, end) {
    const duration = originalBuffer?.duration || 0;
    if (!duration) {
        sectionRepeatStart = 0;
        sectionRepeatEnd = 0;
        return;
    }
    let nextStart = clampSectionTime(Math.min(start, end));
    let nextEnd = clampSectionTime(Math.max(start, end));
    const minimum = Math.min(0.25, duration);
    if (nextEnd - nextStart < minimum) {
        nextEnd = Math.min(duration, nextStart + minimum);
        nextStart = Math.max(0, nextEnd - minimum);
    }
    sectionRepeatStart = nextStart;
    sectionRepeatEnd = nextEnd;
    updateSectionRepeatUI();
}

function updateSectionRepeatUI(current = isPlaying && audioCtx ? audioCtx.currentTime - startTime : pausedAt) {
    const duration = originalBuffer?.duration || 0;
    if (!sectionRepeatBtn || !sectionRepeatEditor) return;
    sectionRepeatBtn.setAttribute('aria-pressed', String(sectionRepeatEnabled));
    sectionRepeatBtn.classList.toggle('is-active', sectionRepeatEnabled);
    sectionRepeatEditor.classList.toggle('hidden', !sectionRepeatEnabled || !duration);
    if (!duration) return;

    const startPct = (sectionRepeatStart / duration) * 100;
    const endPct = (sectionRepeatEnd / duration) * 100;
    const playheadPct = (Math.max(0, Math.min(duration, current)) / duration) * 100;
    if (sectionRepeatRegion) {
        sectionRepeatRegion.style.left = `${startPct}%`;
        sectionRepeatRegion.style.width = `${Math.max(0, endPct - startPct)}%`;
    }
    if (sectionRepeatStartHandle) sectionRepeatStartHandle.style.left = `${startPct}%`;
    if (sectionRepeatEndHandle) sectionRepeatEndHandle.style.left = `${endPct}%`;
    if (sectionRepeatStartBadge) {
        sectionRepeatStartBadge.style.left = `${startPct}%`;
        sectionRepeatStartBadge.innerText = `A ${formatTime(sectionRepeatStart)}`;
    }
    if (sectionRepeatEndBadge) {
        sectionRepeatEndBadge.style.left = `${endPct}%`;
        sectionRepeatEndBadge.innerText = `B ${formatTime(sectionRepeatEnd)}`;
    }
    if (sectionRepeatDurationLabel) {
        sectionRepeatDurationLabel.style.left = `${startPct + ((endPct - startPct) / 2)}%`;
        sectionRepeatDurationLabel.innerText = `선택 ${formatTime(Math.max(0, sectionRepeatEnd - sectionRepeatStart))}`;
    }
    if (sectionRepeatPlayhead) sectionRepeatPlayhead.style.left = `${playheadPct}%`;
    const progress = sectionRepeatBar?.querySelector('.section-repeat-progress');
    if (progress) progress.style.width = `${playheadPct}%`;
    if (sectionRepeatStartLabel) sectionRepeatStartLabel.innerText = `A ${formatTime(sectionRepeatStart)}`;
    if (sectionRepeatEndLabel) sectionRepeatEndLabel.innerText = `B ${formatTime(sectionRepeatEnd)}`;
}

function sectionTimeFromPointer(clientX) {
    const rect = sectionRepeatBar?.getBoundingClientRect();
    const duration = originalBuffer?.duration || 0;
    if (!rect?.width || !duration) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
}

function startSectionRepeatDrag(mode, event) {
    if (!sectionRepeatEnabled || !originalBuffer || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const anchor = sectionTimeFromPointer(event.clientX);
    sectionRepeatDrag = { mode, anchor, start: sectionRepeatStart, end: sectionRepeatEnd };
    if (mode === 'create') setSectionRepeatRange(anchor, anchor);
    sectionRepeatBar?.setPointerCapture?.(event.pointerId);
}

function moveSectionRepeatDrag(event) {
    if (!sectionRepeatDrag) return;
    const time = sectionTimeFromPointer(event.clientX);
    if (sectionRepeatDrag.mode === 'start') setSectionRepeatRange(time, sectionRepeatDrag.end);
    else if (sectionRepeatDrag.mode === 'end') setSectionRepeatRange(sectionRepeatDrag.start, time);
    else if (sectionRepeatDrag.mode === 'create') setSectionRepeatRange(sectionRepeatDrag.anchor, time);
    else if (sectionRepeatDrag.mode === 'move') {
        const duration = originalBuffer?.duration || 0;
        const width = sectionRepeatDrag.end - sectionRepeatDrag.start;
        let start = sectionRepeatDrag.start + (time - sectionRepeatDrag.anchor);
        start = Math.max(0, Math.min(duration - width, start));
        setSectionRepeatRange(start, start + width);
    }
}

function stopSectionRepeatDrag(event) {
    if (!sectionRepeatDrag) return;
    sectionRepeatDrag = null;
    if (sectionRepeatBar?.hasPointerCapture?.(event.pointerId)) {
        sectionRepeatBar.releasePointerCapture(event.pointerId);
    }
}

if (sectionRepeatBtn) {
    sectionRepeatBtn.onclick = () => {
        if (!originalBuffer) return;
        sectionRepeatEnabled = !sectionRepeatEnabled;
        if (sectionRepeatEnabled && !sectionRepeatInitialized) {
            const duration = originalBuffer.duration;
            setSectionRepeatRange(duration * 0.2, duration * 0.8);
            sectionRepeatInitialized = true;
        }
        updateSectionRepeatUI();
    };
}
if (sectionRepeatBar) {
    sectionRepeatBar.onpointerdown = (event) => {
        const mode = event.target === sectionRepeatStartHandle
            ? 'start'
            : event.target === sectionRepeatEndHandle
                ? 'end'
                : event.target === sectionRepeatRegion
                    ? 'move'
                    : 'create';
        startSectionRepeatDrag(mode, event);
    };
    sectionRepeatBar.onpointermove = moveSectionRepeatDrag;
    sectionRepeatBar.onpointerup = stopSectionRepeatDrag;
    sectionRepeatBar.onpointercancel = stopSectionRepeatDrag;
}

const utilityEffectConfigs = [
    { key: 'noiseEnabled', inputId: 'noise-reducer', valId: 'noise-val', buttonId: 'noise-toggle', color: 'rose' },
    { key: 'deesserEnabled', inputId: 'deesser-reducer', valId: 'deesser-val', buttonId: 'deesser-toggle', color: 'sky' },
    { key: 'saturatorEnabled', inputId: 'saturator-volume', valId: 'saturator-val', buttonId: 'saturator-toggle', color: 'amber' }
];

function utilityButtonClass(color, enabled) {
    const onClasses = {
        rose: "bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-500/30",
        sky: "bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-500/30",
        amber: "bg-amber-500 border-amber-400 text-white shadow-md shadow-amber-500/30"
    };
    return `text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${enabled ? onClasses[color] : "bg-gray-800 border-gray-700 text-gray-400"}`;
}

function updateUtilityEffectToggles() {
    utilityEffectConfigs.forEach(({ key, buttonId, color }) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        const enabled = Boolean(audioState[key]);
        button.setAttribute('aria-pressed', String(enabled));
        button.innerText = enabled ? 'IN' : 'OUT';
        button.className = utilityButtonClass(color, enabled);
    });
}

function setupPostEqUtilityEffects() {
    const target = document.getElementById('post-eq-effects');
    if (!target) return;

    utilityEffectConfigs.forEach(({ key, inputId, valId, buttonId, color }) => {
        const input = document.getElementById(inputId);
        const value = document.getElementById(valId);
        if (!input || !value || document.getElementById(buttonId)) return;

        const card = input.parentElement;
        const header = card ? card.querySelector('.flex.justify-between') : null;
        if (!card || !header) return;

        const right = document.createElement('div');
        right.className = 'flex items-center gap-2';
        const button = document.createElement('button');
        button.id = buttonId;
        button.type = 'button';
        button.onclick = () => {
            audioState[key] = !audioState[key];
            updateUtilityEffectToggles();
            if (audioCtx) applyUtilityEffectSettings(audioCtx);
        };

        header.appendChild(right);
        right.appendChild(button);
        right.appendChild(value);
        target.appendChild(card);
    });

    updateUtilityEffectToggles();
}

function updateRangeFill(input, color = '#22d3ee') {
    if (!input) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || 0);
    const pct = max === min ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    const trackColor = document.body.classList.contains('light-mode') ? '#cbd5e1' : '#1f2937';
    input.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, ${trackColor} ${pct}%, ${trackColor} 100%)`;
}

function updateCompressorRangeFills() {
    document.querySelectorAll('.comp-slider').forEach(input => updateRangeFill(input, '#22d3ee'));
    document.querySelectorAll('.reverb-slider').forEach(input => updateRangeFill(input, '#a855f7'));
    document.querySelectorAll('.limiter-slider').forEach(input => updateRangeFill(input, '#84cc16'));
    document.querySelectorAll('.saturation-slider').forEach(input => updateRangeFill(input, '#f59e0b'));
    updateRangeFill(document.getElementById('master-volume'), '#f43f5e');
    updateRangeFill(document.getElementById('noise-reducer'), '#f43f5e');
    updateRangeFill(document.getElementById('deesser-reducer'), '#0ea5e9');
    updateRangeFill(document.getElementById('saturator-volume'), '#f59e0b');
    updateRangeFill(panControl, '#06b6d4');
    updateRangeFill(frontControl, '#8b5cf6');
}

function formatPanValue(value) {
    const amount = Math.round(Math.abs(value));
    if (amount === 0) return 'C';
    return `${value < 0 ? 'L' : 'R'}${amount}`;
}

function syncSpatialUI() {
    if (panControl) panControl.value = audioState.pan ?? 0;
    if (frontControl) frontControl.value = audioState.front ?? 0;
    if (panValue) panValue.value = formatPanValue(Number(audioState.pan) || 0);
    if (frontValue) {
        const value = Math.round(Number(audioState.front) || 0);
        frontValue.value = value > 0 ? `+${value}` : String(value);
    }
    updateRangeFill(panControl, '#06b6d4');
    updateRangeFill(frontControl, '#8b5cf6');
}

function applySpatialSettings(context = audioCtx) {
    if (!context) return;
    const now = context.currentTime || 0;
    const front = isBypassed ? 0 : Math.max(-100, Math.min(100, Number(audioState.front) || 0));
    const pan = isBypassed ? 0 : Math.max(-1, Math.min(1, (Number(audioState.pan) || 0) / 100));

    // Positive Front adds presence/air and trims body; negative values move the
    // source back with softer highs and slightly more low-mid body.
    frontFilters.body?.gain.setValueAtTime(-front * 0.015, now);
    frontFilters.presence?.gain.setValueAtTime(front * 0.06, now);
    frontFilters.air?.gain.setValueAtTime(front * 0.025, now);
    stereoPannerNode?.pan.setValueAtTime(pan, now);
}

function bindSpatialControls() {
    const commitSpatialInput = (input, nextValue) => {
        if (!input) return;
        const min = Number(input.min);
        const max = Number(input.max);
        input.value = Math.max(min, Math.min(max, Number(nextValue) || 0));
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    if (panControl) {
        panControl.oninput = (event) => {
            audioState.pan = Number(event.target.value) || 0;
            syncSpatialUI();
            applySpatialSettings();
        };
        panControl.ondblclick = () => commitSpatialInput(panControl, 0);
    }
    if (frontControl) {
        frontControl.oninput = (event) => {
            audioState.front = Number(event.target.value) || 0;
            syncSpatialUI();
            applySpatialSettings();
        };
        frontControl.ondblclick = () => commitSpatialInput(frontControl, 0);
    }
    document.querySelectorAll('[data-spatial-target]').forEach((button) => {
        button.onclick = () => {
            const input = document.getElementById(button.dataset.spatialTarget);
            const delta = Number(button.dataset.spatialDelta) || 0;
            commitSpatialInput(input, Number(input?.value || 0) + delta);
        };
    });
    syncSpatialUI();
}

function syncUtilityEffectInput(input, stateKey, valueId, color, enabledKey) {
    if (!input) return;
    const val = parseFloat(input.value);
    audioState[stateKey] = val;

    const valueEl = document.getElementById(valueId);
    if (valueEl) valueEl.innerText = val + ' %';

    updateRangeFill(input, color);

    if (val > 0 && enabledKey && !audioState[enabledKey]) {
        audioState[enabledKey] = true;
        updateUtilityEffectToggles();
    }

    if (audioCtx) applyUtilityEffectSettings(audioCtx);
}

async function compileAudioGraph(context, srcNode, { isolated = false } = {}) {
    const graphEq = isolated ? new EQEffector(audioState) : eq;
    const graphSaturation = isolated ? new SaturationEffector(audioState) : saturation;
    const graphSpread = isolated ? new SpreadEffector(audioState) : spread;
    const graphReverb = isolated ? new ReverbEffector(audioState) : reverb;
    const graphCompressor = isolated ? new CompressorEffector(audioState) : compressor;
    const graphLimiter = isolated ? new LimiterEffector(audioState) : limiter;
    const graphStemFilters = {};
    const graphNoiseFilters = { lowCut: null, highCut: null, deEsser: null, waveShaper: null };
    const graphFrontFilters = { body: null, presence: null, air: null };
    let lastOutputNode = srcNode;

    // 1. EQ
    lastOutputNode = graphEq.connect(context, lastOutputNode, isBypassed);

    // 2. Master saturation
    lastOutputNode = graphSaturation.connect(context, lastOutputNode, () => isBypassed, { startVisualizer: !isolated });

    // 3. Stereo spread
    lastOutputNode = graphSpread.connect(context, lastOutputNode, () => isBypassed);

    // 4. 20 Channel smart stems
    const stemsDisabled = isBypassed || !audioState.stemsEnabled;
    stemRegistry.forEach((stem) => {
        if (activeStemIds.includes(stem.id)) {
            const filter = context.createBiquadFilter();
            filter.type = stem.type;
            filter.frequency.value = stem.freq;
            filter.Q.value = 0.8;
            filter.gain.value = stemsDisabled ? 0 : (audioState.mutes[stem.id] ? -40 : audioState.stems[stem.id]);

            lastOutputNode.connect(filter);
            lastOutputNode = filter;
            graphStemFilters[stem.id] = filter;
        }
    });

    // 5. Noise reduction
    graphNoiseFilters.lowCut = context.createBiquadFilter();
    graphNoiseFilters.lowCut.type = 'highpass';
    graphNoiseFilters.highCut = context.createBiquadFilter();
    graphNoiseFilters.highCut.type = 'lowpass';

    const noiseVal = (!isBypassed && audioState.noiseEnabled) ? audioState.noise : 0;
    graphNoiseFilters.lowCut.frequency.value = isBypassed ? 10 : 10 + (noiseVal * 1.2);
    graphNoiseFilters.highCut.frequency.value = isBypassed ? 22000 : 22000 - (noiseVal * 120);

    lastOutputNode.connect(graphNoiseFilters.lowCut);
    graphNoiseFilters.lowCut.connect(graphNoiseFilters.highCut);
    lastOutputNode = graphNoiseFilters.highCut;

    // 6. De-Esser
    graphNoiseFilters.deEsser = context.createBiquadFilter();
    graphNoiseFilters.deEsser.type = 'peaking';
    graphNoiseFilters.deEsser.frequency.value = 6500;
    graphNoiseFilters.deEsser.Q.value = 2.0;
    graphNoiseFilters.deEsser.gain.value = (!isBypassed && audioState.deesserEnabled) ? - (audioState.deesser / 100) * 12 : 0;

    lastOutputNode.connect(graphNoiseFilters.deEsser);
    lastOutputNode = graphNoiseFilters.deEsser;

    // 7. Tubes Harmonics Exciter
    graphNoiseFilters.waveShaper = context.createWaveShaper();
    graphNoiseFilters.waveShaper.curve = makeExciterCurve((!isBypassed && audioState.saturatorEnabled) ? audioState.saturator : 0);
    graphNoiseFilters.waveShaper.oversample = '4x';

    lastOutputNode.connect(graphNoiseFilters.waveShaper);
    lastOutputNode = graphNoiseFilters.waveShaper;

    // 8. Reverb
    lastOutputNode = graphReverb.connect(context, lastOutputNode, () => isBypassed);

    // 9. Compressor
    lastOutputNode = graphCompressor.connect(context, lastOutputNode, () => isBypassed);

    // 10. Front depth: a dedicated EQ contour independent of the graphic EQ.
    graphFrontFilters.body = context.createBiquadFilter();
    graphFrontFilters.body.type = 'lowshelf';
    graphFrontFilters.body.frequency.value = 220;
    graphFrontFilters.presence = context.createBiquadFilter();
    graphFrontFilters.presence.type = 'peaking';
    graphFrontFilters.presence.frequency.value = 2800;
    graphFrontFilters.presence.Q.value = 0.8;
    graphFrontFilters.air = context.createBiquadFilter();
    graphFrontFilters.air.type = 'highshelf';
    graphFrontFilters.air.frequency.value = 6500;
    const front = isBypassed ? 0 : Number(audioState.front || 0);
    graphFrontFilters.body.gain.value = -front * 0.015;
    graphFrontFilters.presence.gain.value = front * 0.06;
    graphFrontFilters.air.gain.value = front * 0.025;
    lastOutputNode.connect(graphFrontFilters.body);
    graphFrontFilters.body.connect(graphFrontFilters.presence);
    graphFrontFilters.presence.connect(graphFrontFilters.air);
    lastOutputNode = graphFrontFilters.air;

    // 11. Limiter
    lastOutputNode = await graphLimiter.connect(context, lastOutputNode, () => isBypassed);

    // 12. Stereo pan
    const graphStereoPannerNode = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
    if (graphStereoPannerNode) {
        graphStereoPannerNode.pan.value = isBypassed ? 0 : Math.max(-1, Math.min(1, Number(audioState.pan || 0) / 100));
        lastOutputNode.connect(graphStereoPannerNode);
        lastOutputNode = graphStereoPannerNode;
    }

    // 13. Master volume out gain
    const graphMasterGainNode = context.createGain();
    graphMasterGainNode.gain.value = isBypassed ? 1.0 : (audioState.master / 100);

    lastOutputNode.connect(graphMasterGainNode);
    if (!isolated) {
        stemFilters = graphStemFilters;
        noiseFilters = graphNoiseFilters;
        frontFilters = graphFrontFilters;
        stereoPannerNode = graphStereoPannerNode;
        masterGainNode = graphMasterGainNode;
    }
    return graphMasterGainNode;
}

function updateStemsToggleUI() {
    const toggle = document.getElementById('stems-toggle');
    if (toggle) {
        const enabled = audioState.stemsEnabled;
        toggle.setAttribute('aria-pressed', String(enabled));
        toggle.innerText = enabled ? 'IN' : 'OUT';
        toggle.className = enabled
            ? "bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-500 shadow-md transition"
            : "bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-gray-700 transition";
    }
}

// Live control bindings
function bindLiveControlTriggers() {
    eq.bindLiveControls(audioCtx, getPlayState, getBypassState);
    reverb.bindLiveControls(audioCtx, getPlayState, getBypassState, updateCompressorRangeFills);
    compressor.bindLiveControls(audioCtx, getPlayState, getBypassState, updateCompressorRangeFills);
    limiter.bindLiveControls(audioCtx, getPlayState, getBypassState, updateCompressorRangeFills);
    saturation.bindLiveControls(audioCtx, getPlayState, getBypassState, updateCompressorRangeFills);
    spread.bindLiveControls(audioCtx, getPlayState, getBypassState, updateCompressorRangeFills);

    const stemsToggle = document.getElementById('stems-toggle');
    if (stemsToggle) {
        stemsToggle.onclick = () => {
            audioState.stemsEnabled = !audioState.stemsEnabled;
            updateStemsToggleUI();
            if (isPlaying && audioCtx) {
                const stemsDisabled = isBypassed || !audioState.stemsEnabled;
                stemRegistry.forEach(stem => {
                    if (activeStemIds.includes(stem.id) && stemFilters[stem.id]) {
                        const gainVal = stemsDisabled ? 0 : (audioState.mutes[stem.id] ? -40 : audioState.stems[stem.id]);
                        stemFilters[stem.id].gain.setValueAtTime(gainVal, audioCtx.currentTime);
                    }
                });
            }
        };
    }
    updateStemsToggleUI();

    const stemsCollapseBtn = document.getElementById('stems-collapse-btn');
    const stemsCollapseContent = document.getElementById('stems-collapse-content');
    const stemsCollapseIcon = document.getElementById('stems-collapse-icon');
    if (stemsCollapseBtn && stemsCollapseContent && stemsCollapseIcon) {
        stemsCollapseBtn.onclick = () => {
            const isCollapsed = stemsCollapseContent.classList.contains('hidden');
            if (isCollapsed) {
                stemsCollapseContent.classList.remove('hidden');
                stemsCollapseIcon.className = "fa-solid fa-chevron-up";
            } else {
                stemsCollapseContent.classList.add('hidden');
                stemsCollapseIcon.className = "fa-solid fa-chevron-down";
            }
            setTimeout(() => {
                handleResize();
            }, 100);
        };
    }

    const eqCollapseBtn = document.getElementById('eq-collapse-btn');
    const eqCollapseContent = document.getElementById('eq-collapse-content');
    const eqCollapseIcon = document.getElementById('eq-collapse-icon');
    if (eqCollapseBtn && eqCollapseContent && eqCollapseIcon) {
        eqCollapseBtn.onclick = () => {
            const isCollapsed = eqCollapseContent.classList.contains('hidden');
            if (isCollapsed) {
                eqCollapseContent.classList.remove('hidden');
                eqCollapseIcon.className = "fa-solid fa-chevron-up";
                eqCollapseBtn.setAttribute('aria-expanded', 'true');
                window.setTimeout(() => eq.drawEQCanvas?.(), 0);
            } else {
                eqCollapseContent.classList.add('hidden');
                eqCollapseIcon.className = "fa-solid fa-chevron-down";
                eqCollapseBtn.setAttribute('aria-expanded', 'false');
            }
            setTimeout(() => {
                handleResize();
            }, 100);
        };
    }

    stemRegistry.forEach((stem) => {
        const targetSlider = document.getElementById(`input-${stem.id}`);
        if (targetSlider) {
            targetSlider.oninput = (e) => {
                let val = parseFloat(e.target.value);
                audioState.stems[stem.id] = val;
                const valText = document.getElementById(`val-${stem.id}`);
                if(valText && !audioState.mutes[stem.id]) valText.innerText = val + ' dB';
                const stemsDisabled = isBypassed || !audioState.stemsEnabled;
                if (isPlaying && !stemsDisabled && stemFilters[stem.id] && !audioState.mutes[stem.id]) {
                    stemFilters[stem.id].gain.setValueAtTime(val, audioCtx.currentTime);
                }
            };
        }
    });

    document.getElementById('noise-reducer').oninput = (e) => {
        syncUtilityEffectInput(e.target, 'noise', 'noise-val', '#f43f5e', 'noiseEnabled');
    };

    document.getElementById('deesser-reducer').oninput = (e) => {
        syncUtilityEffectInput(e.target, 'deesser', 'deesser-val', '#0ea5e9', 'deesserEnabled');
    };

    document.getElementById('saturator-volume').oninput = (e) => {
        syncUtilityEffectInput(e.target, 'saturator', 'saturator-val', '#f59e0b', 'saturatorEnabled');
    };

    document.getElementById('master-volume').oninput = (e) => {
        const val = parseFloat(e.target.value);
        audioState.master = val;
        document.getElementById('master-val').innerText = val + ' %';
        updateRangeFill(e.target, '#f43f5e');
        if (isPlaying && !isBypassed && masterGainNode) {
            masterGainNode.gain.setValueAtTime(val / 100, audioCtx.currentTime);
        }
    };

    document.querySelectorAll('.transport-step-btn').forEach((button) => {
        button.onclick = () => {
            const input = document.getElementById(button.dataset.target);
            if (!input) return;
            const direction = Number(button.dataset.dir) || 0;
            const step = Number(input.step) || 1;
            const min = Number(input.min);
            const max = Number(input.max);
            const current = Number(input.value) || 0;
            const next = Math.max(min, Math.min(max, current + (step * direction)));
            input.value = String(Number(next.toFixed(4)));
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
    });
}

reverb.populatePresets('reverb-preset');
reverb.syncInputs();
const reverbPresetSelectInit = document.getElementById('reverb-preset');
if (reverbPresetSelectInit) reverbPresetSelectInit.value = "default:default_reverb";
reverb.updateUI(updateCompressorRangeFills);
setupPostEqUtilityEffects();
compressor.populateTemplates('comp-template-select');
compressor.updateUI(updateCompressorRangeFills);
limiter.initVisualizers();
limiter.updateUI(updateCompressorRangeFills);
saturation.populatePresets('saturation-preset');
saturation.syncInputs();
saturation.initVisualizers();
saturation.updateUI(updateCompressorRangeFills);
spread.populatePresets('spread-preset');
spread.syncInputs();
spread.updateUI(updateCompressorRangeFills);
bindLiveControlTriggers();
bindSpatialControls();
reverb.initVisualizers(updateCompressorRangeFills);
compressor.initGraphInteraction(updateCompressorRangeFills);
setupResizableEffectGraphs();

// Load upload activation preference configurations
const cfgSeekBar = document.getElementById('cfg-seek-bar');
const cfgTubeExciter = document.getElementById('cfg-tube-exciter');

if (cfgSeekBar) {
    const saved = localStorage.getItem('jd-cfg-seek-bar');
    cfgSeekBar.checked = saved !== null ? (saved === 'true') : true;
    cfgSeekBar.onchange = () => {
        localStorage.setItem('jd-cfg-seek-bar', String(cfgSeekBar.checked));
    };
}
if (cfgTubeExciter) {
    const saved = localStorage.getItem('jd-cfg-tube-exciter');
    cfgTubeExciter.checked = saved !== null ? (saved === 'true') : false;
    cfgTubeExciter.onchange = () => {
        localStorage.setItem('jd-cfg-tube-exciter', String(cfgTubeExciter.checked));
    };
}

// Master Reset console
document.getElementById('reset-all-btn').onclick = () => {
    if (!window.confirm('현재 프로젝트를 진짜 초기화할까요?')) return;
    executeBypassRouting(true);
    resetLoudnessStats();
    audioState.eq = new Array(20).fill(0);
    audioState.eqEnabled = false;
    audioState.stemsEnabled = false;
    updateStemsToggleUI();
    audioState.noise = 0;
    audioState.noiseEnabled = false;
    audioState.deesser = 0;
    audioState.deesserEnabled = false;
    audioState.saturator = 0;
    audioState.saturatorEnabled = false;
    audioState.masterSaturation = {
        enabled: false,
        drive: 2.3,
        mix: 61,
        output: 0,
        tone: 12,
        bias: 0,
        character: 42,
        evenOdd: 35,
        dynamics: -10,
        oversampling: 4,
        mode: "tube",
        bandLow: 223,
        bandHigh: 2350
    };
    audioState.spread = {
        enabled: false,
        spread: 45,
        centerDb: 0,
        sideDb: -9,
        lowCutHz: 160
    };
    isLooping = false;
    updateLoopButton();
    sectionRepeatEnabled = false;
    sectionRepeatInitialized = false;
    sectionRepeatStart = 0;
    sectionRepeatEnd = originalBuffer?.duration || 0;
    updateSectionRepeatUI(0);
    audioState.reverb = {
        enabled: false,
        preDelay: 105,
        decay: 1.8,
        diffusion: 58,
        lowGain: -1,
        highGain: 1.5,
        mix: 22
    };
    audioState.compressor = {
        enabled: false,
        inputGain: 0,
        threshold: -24,
        ratio: 4,
        attack: 0.003,
        release: 0.25,
        knee: 30,
        makeup: 6
    };
    audioState.limiter = {
        enabled: false,
        threshold: -1,
        release: 100,
        outputGain: 0
    };
    audioState.pan = 0;
    audioState.front = 0;
    audioState.master = 100;

    eq.resetUI();
    document.getElementById('noise-reducer').value = 0;
    document.getElementById('noise-val').innerText = "0 %";
    document.getElementById('deesser-reducer').value = 0;
    document.getElementById('deesser-val').innerText = "0 %";
    document.getElementById('saturator-volume').value = 0;
    document.getElementById('saturator-val').innerText = "0 %";
    updateUtilityEffectToggles();
    updateCompressorRangeFills();
    if (audioCtx) applyUtilityEffectSettings(audioCtx);
    saturation.syncInputs();
    saturation.updateUI(updateCompressorRangeFills);
    if (isPlaying && audioCtx) saturation.applySettings(audioCtx, () => isBypassed);
    spread.syncInputs();
    const spreadPresetSelect = document.getElementById('spread-preset');
    if (spreadPresetSelect) spreadPresetSelect.value = "default";
    spread.updateUI(updateCompressorRangeFills);
    if (isPlaying && audioCtx) spread.applySettings(audioCtx, () => isBypassed);
    reverb.syncInputs();
    const reverbPresetSelect = document.getElementById('reverb-preset');
    if (reverbPresetSelect) reverbPresetSelect.value = "default:default_reverb";
    reverb.updateUI(updateCompressorRangeFills);
    if (isPlaying && audioCtx) reverb.applySettings(audioCtx, () => isBypassed, true);
    
    document.getElementById('comp-inputgain').value = 0;
    document.getElementById('comp-threshold').value = -24;
    document.getElementById('comp-ratio').value = 4;
    document.getElementById('comp-attack').value = 0.003;
    document.getElementById('comp-release').value = 0.25;
    document.getElementById('comp-knee').value = 30;
    document.getElementById('comp-makeup').value = 6;
    compressor.updateUI(updateCompressorRangeFills);
    if (isPlaying && audioCtx) compressor.applySettings(audioCtx, () => isBypassed);

    document.getElementById('limiter-threshold').value = -1;
    document.getElementById('limiter-release').value = 100;
    document.getElementById('limiter-output').value = 0;
    limiter.updateUI(updateCompressorRangeFills);
    if (isPlaying && audioCtx) limiter.applySettings(audioCtx, () => isBypassed);

    document.getElementById('master-volume').value = 100;
    document.getElementById('master-val').innerText = "100 %";
    syncSpatialUI();
    applySpatialSettings();
    updateCompressorRangeFills();

    stemRegistry.forEach((stem) => {
        audioState.stems[stem.id] = 0;
        audioState.mutes[stem.id] = false;
        const input = document.getElementById(`input-${stem.id}`);
        const mBtn = document.getElementById(`mute-${stem.id}`);
        const valText = document.getElementById(`val-${stem.id}`);
        if (input) input.value = 0;
        if (mBtn) mBtn.className = "bg-gray-800 text-gray-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-gray-700 hover:bg-gray-700 transition";
        if (valText && activeStemIds.includes(stem.id)) valText.innerText = "0 dB";
    });

    document.querySelectorAll('#genre-grid button').forEach(b => b.classList.remove('genre-active'));
    const noneBtnEl = document.querySelector('#genre-grid button');
    if (noneBtnEl) noneBtnEl.classList.add('genre-active');
    if(isPlaying) playBtn.click();
};

async function clearAllLoadedFiles() {
    if (activeExportJob) {
        activeExportJob.cancelled = true;
        if (activeExportJob.timer) window.clearInterval(activeExportJob.timer);
        activeExportJob = null;
    }
    if (pendingUploadChoiceResolve) pendingUploadChoiceResolve('replace');
    stopCurrentAudioSource(false);
    stopWaveformLoading(false);
    disposeRealtimeAudioGraph();
    audioUploadController?.reset?.();

    currentAudioFileBlob = null;
    currentAudioFileName = '';
    originalBuffer = null;
    waveformPeaks = [];
    masteredWaveformPeaks = [];
    audioTimelineClips = [];
    activeTimelineClipIndex = 0;
    activeStemIds = [];
    pausedAt = 0;
    startTime = 0;
    isPlaying = false;
    isLooping = false;
    sectionRepeatEnabled = false;
    sectionRepeatInitialized = false;
    sectionRepeatStart = 0;
    sectionRepeatEnd = 0;
    forceAppendNextUpload = false;
    restoringPersistedAudio = false;

    if (upload) upload.value = '';
    if (audioUploadChoice) audioUploadChoice.classList.add('hidden');
    if (exportProgressPanel) exportProgressPanel.classList.add('hidden');
    if (exportCancelBtn) exportCancelBtn.disabled = false;
    setExportProgress(0, 'WAV 내보내기 준비 중');
    setTimedLyrics('');
    resetLoudnessStats();
    updateLoopButton();
    updateSectionRepeatUI(0);
    setProgressBarValue(0);
    updateWaveformProgress(0);
    renderAudioTimeline();
    syncStemsUI();
    trackName.innerText = 'Waiting for audio upload...';
    detectorStatus.innerText = '(추출 대기 중)';
    playBtn.innerHTML = '<i class="fa-solid fa-play ml-0.5"></i>';
    playBtn.disabled = true;
    progressBar.disabled = true;
    setAudioTransportAvailability(false);
    setDownloadButtonEnabled(false);
    playBtn.classList.add('opacity-40', 'cursor-not-allowed');
    downloadBtn.classList.add('opacity-40', 'cursor-not-allowed');
    updateExportFilenamePreview();

    await window.jjimHandoff?.clearState?.();
}

const clearAllFilesBtn = document.getElementById('clear-all-files-btn');
if (clearAllFilesBtn) {
    clearAllFilesBtn.onclick = async () => {
        const confirmed = window.confirm(
            '현재 불러온 음원, 커버, 가사, 마스터 결과와 자동 복원 캐시를 모두 지우고 새로 시작할까요?\n\n저장한 프로젝트와 사용자 프리셋은 삭제되지 않습니다.'
        );
        if (!confirmed) return;
        clearAllFilesBtn.disabled = true;
        try {
            await clearAllLoadedFiles();
        } catch (error) {
            console.error('전체 파일 초기화 실패:', error);
            window.alert(`전체 파일 초기화 중 오류가 발생했습니다: ${error?.message || error}`);
        } finally {
            clearAllFilesBtn.disabled = false;
        }
    };
}

// Function to synchronize the stems UI based on the activeStemIds and mutes
function syncStemsUI() {
    stemRegistry.forEach((stem) => {
        const card = document.getElementById(`card-${stem.id}`);
        const title = document.getElementById(`title-${stem.id}`);
        const valueText = document.getElementById(`val-${stem.id}`);
        const input = document.getElementById(`input-${stem.id}`);
        const mBtn = document.getElementById(`mute-${stem.id}`);

        if (!card) return;

        if (activeStemIds.includes(stem.id)) {
            card.className = "bg-[#0d1322] p-2.5 rounded-xl border border-gray-800 flex flex-col space-y-1 opacity-100 shadow-md transition-all";
            title.className = `${stem.color} font-bold text-xs truncate`;
            title.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5 animate-pulse text-[10px]"></i>${stem.name}`;
            
            const isMuted = audioState.mutes[stem.id];
            if (isMuted) {
                mBtn.className = "bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded border border-red-500 shadow-lg shadow-red-900/30";
                valueText.className = "font-mono text-red-400 text-[10px]";
                valueText.innerText = "MUTED";
            } else {
                mBtn.className = "bg-gray-800 text-gray-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-gray-700 hover:bg-gray-700 transition";
                valueText.className = "font-mono text-gray-300 text-[10px]";
                valueText.innerText = audioState.stems[stem.id] + " dB";
            }
            
            input.disabled = false;
            input.value = audioState.stems[stem.id];
            input.className = `w-full h-1 bg-gray-800 rounded appearance-none ${stem.accent}`;
            
            mBtn.disabled = false;
            mBtn.onclick = () => {
                audioState.mutes[stem.id] = !audioState.mutes[stem.id];
                if(audioState.mutes[stem.id]) {
                    mBtn.className = "bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded border border-red-500 shadow-lg shadow-red-900/30";
                    valueText.className = "font-mono text-red-400 text-[10px]";
                    valueText.innerText = "MUTED";
                    if(isPlaying && !isBypassed && stemFilters[stem.id]) stemFilters[stem.id].gain.setValueAtTime(-40, audioCtx.currentTime);
                } else {
                    mBtn.className = "bg-gray-800 text-gray-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-gray-700 hover:bg-gray-700 transition";
                    valueText.className = "font-mono text-gray-300 text-[10px]";
                    valueText.innerText = audioState.stems[stem.id] + " dB";
                    if(isPlaying && !isBypassed && stemFilters[stem.id]) stemFilters[stem.id].gain.setValueAtTime(audioState.stems[stem.id], audioCtx.currentTime);
                }
            };
        } else {
            card.className = "bg-[#03050a]/60 p-2.5 rounded-xl border border-gray-900 flex flex-col space-y-1 opacity-20 pointer-events-none select-none";
            title.className = "text-gray-600 text-xs truncate";
            title.innerHTML = `<i class="fa-solid fa-ban mr-1.5 text-[10px]"></i>Empty Slot`;
            valueText.className = "font-mono text-gray-700 text-[10px]";
            valueText.innerText = "Disabled";
            input.disabled = true;
            mBtn.disabled = true;
        }
    });

    const statusEl = document.getElementById('detector-status');
    if (statusEl) {
        if (activeStemIds.length > 0) {
            statusEl.innerText = `(${activeStemIds.length}/20 채널 자동 분리 추출 완료)`;
        } else {
            statusEl.innerText = "(추출 대기 중)";
        }
    }
}

function getCurrentPlaybackTime() {
    if (!originalBuffer) return 0;
    const current = isPlaying && audioCtx ? audioCtx.currentTime - startTime : pausedAt;
    return Math.max(0, Math.min(originalBuffer.duration, Number(current) || 0));
}

function stopCurrentAudioSource(keepPosition = true) {
    const position = keepPosition ? getCurrentPlaybackTime() : 0;
    if (sourceNode) {
        try { sourceNode.onended = null; } catch (error) {}
        try { sourceNode.stop(); } catch (error) {}
        try { sourceNode.disconnect(); } catch (error) {}
    }
    sourceNode = null;
    isPlaying = false;
    pausedAt = position;
    playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;
    return position;
}

function showAudioUploadChoice(file) {
    if (!audioUploadChoice || !audioUploadReplaceBtn || !audioUploadAppendBtn) {
        return Promise.resolve('replace');
    }
    if (pendingUploadChoiceResolve) {
        pendingUploadChoiceResolve('replace');
        pendingUploadChoiceResolve = null;
    }
    if (audioUploadChoiceFile) audioUploadChoiceFile.textContent = file?.name || '새 음원';
    audioUploadChoice.classList.remove('hidden');
    return new Promise((resolve) => {
        pendingUploadChoiceResolve = (choice) => {
            audioUploadChoice.classList.add('hidden');
            pendingUploadChoiceResolve = null;
            resolve(choice);
        };
        audioUploadReplaceBtn.onclick = () => pendingUploadChoiceResolve?.('replace');
        audioUploadAppendBtn.onclick = () => pendingUploadChoiceResolve?.('append');
    });
}

function createTimelineClip(file, buffer) {
    const last = audioTimelineClips[audioTimelineClips.length - 1];
    const start = last ? last.start + last.duration : 0;
    return {
        id: `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        name: file?.name || 'Audio Clip',
        buffer,
        start,
        duration: buffer.duration,
        volume: 100,
        gapAfterMs: timelineGapMs,
        fadeInEnabled: false,
        fadeInDuration: 1,
        fadeOutEnabled: false,
        fadeOutDuration: 1,
        settings: captureTimelineSettings(),
        waveformPeaks: []
    };
}

function captureTimelineSettings() {
    return JSON.parse(JSON.stringify({
        eq: audioState.eq,
        eqEnabled: audioState.eqEnabled,
        masterSaturation: audioState.masterSaturation,
        reverb: audioState.reverb,
        compressor: audioState.compressor,
        limiter: audioState.limiter,
        noiseEnabled: audioState.noiseEnabled,
        noise: audioState.noise,
        deesserEnabled: audioState.deesserEnabled,
        deesser: audioState.deesser,
        saturatorEnabled: audioState.saturatorEnabled,
        saturator: audioState.saturator,
        pan: audioState.pan,
        front: audioState.front,
        master: audioState.master
    }));
}

function applyTimelineSettings(settings) {
    if (!settings) return;
    Object.assign(audioState, JSON.parse(JSON.stringify(settings)));
    applyAllLoadedSettings();
}

function saveActiveTimelineSettings() {
    const clip = audioTimelineClips[activeTimelineClipIndex];
    if (clip) clip.settings = captureTimelineSettings();
}

function getTimelineClipIndexAt(time) {
    if (!audioTimelineClips.length) return -1;
    const safeTime = Math.max(0, Number(time) || 0);
    const found = audioTimelineClips.findIndex((clip, index) => {
        const end = clip.start + clip.duration;
        return safeTime >= clip.start && (safeTime < end || index === audioTimelineClips.length - 1);
    });
    if (found >= 0) return found;
    for (let i = audioTimelineClips.length - 1; i >= 0; i -= 1) {
        if (safeTime >= audioTimelineClips[i].start) return i;
    }
    return 0;
}

function getTimelineTotalDuration() {
    if (!audioTimelineClips.length) return 0;
    const last = audioTimelineClips[audioTimelineClips.length - 1];
    return Math.max(0, (last.start || 0) + (last.duration || 0));
}

function setTimelineGapMs(value, { rebuild = true } = {}) {
    timelineGapMs = Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
    if (audioTimelineGapInput) audioTimelineGapInput.value = String(timelineGapMs);
    if (audioTimelineGapValue) audioTimelineGapValue.textContent = `${timelineGapMs} ms`;
    if (rebuild && audioTimelineClips.length) {
        void refreshTimelineAudioBuffer({ keepTime: true, restart: true });
    }
}

function setTimelineClipGap(index, value, { rebuild = true } = {}) {
    const clip = audioTimelineClips[index];
    if (!clip) return;
    clip.gapAfterMs = Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
    if (rebuild) void refreshTimelineAudioBuffer({ keepTime: true, restart: true });
    else renderAudioTimeline();
}

function applyTimelineGapToAll() {
    audioTimelineClips.forEach((clip) => {
        clip.gapAfterMs = timelineGapMs;
    });
    if (audioTimelineClips.length) {
        void refreshTimelineAudioBuffer({ keepTime: true, restart: true });
    } else {
        renderAudioTimeline();
    }
}

function setActiveTimelineClip(index, { seek = true, restoreSettings = true, keepPlayback = false } = {}) {
    if (!audioTimelineClips.length) return;
    const nextIndex = Math.max(0, Math.min(audioTimelineClips.length - 1, Number(index) || 0));
    if (nextIndex !== activeTimelineClipIndex) saveActiveTimelineSettings();
    activeTimelineClipIndex = nextIndex;
    const clip = audioTimelineClips[activeTimelineClipIndex];
    if (restoreSettings) applyTimelineSettings(clip.settings);
    renderAudioTimeline();
    if (seek) void seekToTime(clip.start, keepPlayback);
}

function rebuildAudioTimelineBuffer() {
    if (!audioCtx || !audioTimelineClips.length) return null;
    timelineRebuildInProgress = true;
    const sampleRate = audioCtx.sampleRate;
    const channels = Math.max(1, ...audioTimelineClips.map((clip) => clip.buffer.numberOfChannels));
    let cursor = 0;
    const normalized = audioTimelineClips.map((clip, index) => {
        const start = cursor / sampleRate;
        const length = clip.buffer.length;
        cursor += length;
        const gapSamples = Math.max(0, Math.round((Number(clip.gapAfterMs ?? timelineGapMs) || 0) / 1000 * sampleRate));
        if (index < audioTimelineClips.length - 1) cursor += gapSamples;
        return { ...clip, start, duration: length / sampleRate };
    });
    audioTimelineClips = normalized;
    const combined = audioCtx.createBuffer(channels, Math.max(1, cursor), sampleRate);
    let offset = 0;
    audioTimelineClips.forEach((clip) => {
        for (let ch = 0; ch < channels; ch += 1) {
            const sourceChannel = Math.min(ch, clip.buffer.numberOfChannels - 1);
            const sourceData = clip.buffer.getChannelData(sourceChannel);
            const targetData = combined.getChannelData(ch);
            const volumeGain = Math.max(0, Math.min(3, Number(clip.volume ?? 100) / 100));
            const fadeInSamples = clip.fadeInEnabled ? Math.min(sourceData.length, Math.round((Number(clip.fadeInDuration) || 1) * sampleRate)) : 0;
            const fadeOutSamples = clip.fadeOutEnabled ? Math.min(sourceData.length, Math.round((Number(clip.fadeOutDuration) || 1) * sampleRate)) : 0;
            for (let i = 0; i < sourceData.length; i += 1) {
                let gain = volumeGain;
                if (fadeInSamples > 0 && i < fadeInSamples) gain *= i / Math.max(1, fadeInSamples);
                if (fadeOutSamples > 0 && i >= sourceData.length - fadeOutSamples) {
                    gain *= (sourceData.length - i) / Math.max(1, fadeOutSamples);
                }
                targetData[offset + i] = sourceData[i] * gain;
            }
        }
        offset += clip.buffer.length;
        if (clip !== audioTimelineClips[audioTimelineClips.length - 1]) {
            offset += Math.max(0, Math.round((Number(clip.gapAfterMs ?? timelineGapMs) || 0) / 1000 * sampleRate));
        }
    });
    timelineRebuildInProgress = false;
    return combined;
}

async function refreshTimelineAudioBuffer({ keepTime = true, restart = true, saveSettings = true } = {}) {
    if (!audioTimelineClips.length) return;
    if (saveSettings) saveActiveTimelineSettings();
    const currentTime = keepTime ? getCurrentPlaybackTime() : audioTimelineClips[activeTimelineClipIndex]?.start || 0;
    const wasPlaying = restart && isPlaying;
    if (sourceNode) {
        try { sourceNode.stop(); } catch (error) {}
        try { sourceNode.disconnect(); } catch (error) {}
    }
    isPlaying = false;
    sourceNode = null;
    const combined = rebuildAudioTimelineBuffer();
    if (!combined) return;
    originalBuffer = combined;
    masteredWaveformPeaks = [];
    waveformPeaks = buildWaveformPeaks(combined);
    const target = Math.max(0, Math.min(combined.duration, currentTime));
    pausedAt = target;
    setProgressBarValue(combined.duration ? (target / combined.duration) * 100 : 0);
    updateWaveformProgress(target);
    renderAudioTimeline();
    if (wasPlaying) await startPlaybackAt(target);
}

function renderAudioTimeline() {
    if (!audioTimelinePanel || !audioTimelineStrip) return;
    audioTimelinePanel.classList.remove('hidden');
    if (audioTimelineSummary) {
        const total = getTimelineTotalDuration();
        audioTimelineSummary.textContent = `${audioTimelineClips.length}개 트랙 · ${formatTime(total)}`;
    }
    const trackCount = document.getElementById('audio-timeline-track-count');
    if (trackCount) trackCount.textContent = `${audioTimelineClips.length}개 트랙`;
    if (!audioTimelineClips.length) {
        const empty = document.createElement('div');
        empty.className = 'audio-timeline-empty';
        empty.innerHTML = `<i class="fa-solid fa-plus"></i><span>음원을 업로드하면 이곳에 오디오 타임라인이 생성됩니다.</span>`;
        audioTimelineStrip.replaceChildren(empty);
        return;
    }
    const totalDuration = Math.max(1, getTimelineTotalDuration());

    const ruler = document.createElement('div');
    ruler.className = 'audio-timeline-ruler';
    const playhead = document.createElement('div');
    playhead.className = 'audio-timeline-playhead';
    playhead.id = 'audio-timeline-playhead';
    playhead.style.left = `${Math.max(0, Math.min(100, (getCurrentPlaybackTime() / totalDuration) * 100))}%`;
    ruler.appendChild(playhead);
    audioTimelineClips.forEach((clip, index) => {
        const block = document.createElement('div');
        block.className = `audio-timeline-block${index === 0 ? ' is-main' : ''}`;
        const left = Math.max(0, Math.min(100, (clip.start / totalDuration) * 100));
        const width = Math.max(3, Math.min(100, (clip.duration / totalDuration) * 100));
        block.style.left = `${left}%`;
        block.style.width = `${width}%`;
        block.title = `${clip.name} · ${formatTime(clip.start)} → ${formatTime(clip.start + clip.duration)}`;
        const label = document.createElement('span');
        label.textContent = index === 0 ? '메인' : `${index + 1}`;
        block.appendChild(label);
        const waves = document.createElement('div');
        waves.className = 'audio-timeline-wave-bars';
        for (let i = 0; i < 72; i += 1) {
            const bar = document.createElement('i');
            const phase = (i + 1) * (index + 2) * 0.37;
            bar.style.height = `${28 + Math.abs(Math.sin(phase)) * 58}%`;
            waves.appendChild(bar);
        }
        block.appendChild(waves);
        ruler.appendChild(block);
    });

    const list = document.createElement('div');
    list.className = 'audio-timeline-clip-list';
    audioTimelineClips.forEach((clip, index) => {
        const item = document.createElement('div');
        item.className = `audio-timeline-clip${index === 0 ? ' is-main' : ''}${index === activeTimelineClipIndex ? ' is-active' : ''}`;
        item.dataset.clipIndex = String(index);
        const idx = document.createElement('span');
        idx.className = 'audio-timeline-clip-index';
        idx.textContent = index === 0 ? 'M' : String(index + 1);
        const body = document.createElement('span');
        body.className = 'min-w-0';
        const name = document.createElement('span');
        name.className = 'audio-timeline-clip-name';
        name.textContent = clip.name;
        const meta = document.createElement('span');
        meta.className = 'audio-timeline-clip-meta';
        meta.textContent = `${formatTime(clip.start)} → ${formatTime(clip.start + clip.duration)}`;
        const controls = document.createElement('div');
        controls.className = 'audio-timeline-clip-controls';
        controls.innerHTML = `
            <label>Vol <input type="range" min="0" max="200" step="1" value="${Math.round(clip.volume ?? 100)}" data-timeline-action="volume" data-index="${index}"><b>${Math.round(clip.volume ?? 100)}%</b></label>
            <label class="audio-timeline-check"><input type="checkbox" ${clip.fadeInEnabled ? 'checked' : ''} data-timeline-action="fadeInToggle" data-index="${index}"> Fade In</label>
            <input class="audio-timeline-fade-time" type="number" min="0.1" max="30" step="0.1" value="${Number(clip.fadeInDuration ?? 1)}" data-timeline-action="fadeInTime" data-index="${index}">
            <label class="audio-timeline-check"><input type="checkbox" ${clip.fadeOutEnabled ? 'checked' : ''} data-timeline-action="fadeOutToggle" data-index="${index}"> Fade Out</label>
            <input class="audio-timeline-fade-time" type="number" min="0.1" max="30" step="0.1" value="${Number(clip.fadeOutDuration ?? 1)}" data-timeline-action="fadeOutTime" data-index="${index}">
            <label class="audio-timeline-gap-inline">Next Gap <button type="button" data-timeline-action="gapMinus" data-index="${index}" ${index >= audioTimelineClips.length - 1 ? 'disabled' : ''}>−</button><input class="audio-timeline-gap-time" type="number" min="0" max="10000" step="10" value="${Math.round(clip.gapAfterMs ?? timelineGapMs)}" data-timeline-action="gapAfter" data-index="${index}" ${index >= audioTimelineClips.length - 1 ? 'disabled' : ''}><button type="button" data-timeline-action="gapPlus" data-index="${index}" ${index >= audioTimelineClips.length - 1 ? 'disabled' : ''}>+</button><b>ms</b></label>
        `;
        body.append(name, meta, controls);
        const duration = document.createElement('span');
        duration.className = 'audio-timeline-clip-duration';
        duration.innerHTML = `
            <button type="button" data-timeline-action="select" data-index="${index}" title="이 곡 듣기"><i class="fa-solid fa-play"></i></button>
            <button type="button" data-timeline-action="saveSettings" data-index="${index}" title="현재 설정 저장"><i class="fa-solid fa-floppy-disk"></i></button>
            <button type="button" data-timeline-action="delete" data-index="${index}" title="삭제" ${audioTimelineClips.length <= 1 ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
            <span>${formatTime(clip.duration)}</span>
        `;
        item.append(idx, body, duration);
        list.appendChild(item);
    });

    const addSlot = document.createElement('div');
    addSlot.className = 'audio-timeline-add-slot';
    addSlot.dataset.timelineAction = 'appendUpload';
    addSlot.setAttribute('role', 'button');
    addSlot.setAttribute('tabindex', '0');
    addSlot.setAttribute('aria-label', '오디오 타임라인에 음원 추가');
    addSlot.innerHTML = `<i class="fa-solid fa-plus"></i><span>추가 음원은 업로드 후<br>“오디오 타임라인에 추가” 선택</span>`;
    list.appendChild(addSlot);
    audioTimelineStrip.replaceChildren(ruler, list);
    updateAudioTimelinePlayhead(getCurrentPlaybackTime());
    updateTrackNavigationButtons();
}

function updateAudioTimelinePlayhead(current = 0) {
    const playhead = document.getElementById('audio-timeline-playhead');
    if (!playhead || !audioTimelineClips.length) return;
    const total = Math.max(1, getTimelineTotalDuration());
    playhead.style.left = `${Math.max(0, Math.min(100, (current / total) * 100))}%`;
    const nextIndex = getTimelineClipIndexAt(current);
    if (nextIndex >= 0 && nextIndex !== activeTimelineClipIndex) {
        saveActiveTimelineSettings();
        activeTimelineClipIndex = nextIndex;
        applyTimelineSettings(audioTimelineClips[nextIndex]?.settings);
        renderAudioTimeline();
    }
    updateTrackNavigationButtons();
}

function updateTrackNavigationButtons() {
    const enabled = audioTimelineClips.length > 1;
    trackNav?.classList.toggle('has-tracks', enabled);
    if (trackPrevBtn) trackPrevBtn.disabled = !enabled || activeTimelineClipIndex <= 0;
    if (trackNextBtn) trackNextBtn.disabled = !enabled || activeTimelineClipIndex >= audioTimelineClips.length - 1;
}

if (audioTimelineHeader && audioTimelineContent) {
    audioTimelineHeader.onclick = () => {
        const collapsed = !audioTimelineContent.classList.contains('hidden');
        audioTimelineContent.classList.toggle('hidden', collapsed);
        audioTimelineHeader.setAttribute('aria-expanded', String(!collapsed));
        if (audioTimelineChevron) audioTimelineChevron.className = `fa-solid fa-chevron-${collapsed ? 'down' : 'up'}`;
    };
}

audioTimelineStrip?.addEventListener('click', async (event) => {
    const control = event.target.closest('[data-timeline-action]');
    const clipCard = event.target.closest('.audio-timeline-clip');
    if (!control && clipCard) {
        setActiveTimelineClip(Number(clipCard.dataset.clipIndex || 0));
        return;
    }
    if (!control) return;
    const index = Number(control.dataset.index || 0);
    const action = control.dataset.timelineAction;
    if (action === 'appendUpload') {
        event.stopPropagation();
        forceAppendNextUpload = Boolean(originalBuffer);
        upload?.click();
        return;
    }
    const clip = audioTimelineClips[index];
    if (!clip) return;
    event.stopPropagation();
    if (action === 'select') {
        setActiveTimelineClip(index);
    } else if (action === 'saveSettings') {
        activeTimelineClipIndex = index;
        saveActiveTimelineSettings();
        renderAudioTimeline();
    } else if (action === 'delete' && audioTimelineClips.length > 1) {
        const wasActive = index === activeTimelineClipIndex;
        if (!wasActive) saveActiveTimelineSettings();
        audioTimelineClips.splice(index, 1);
        activeTimelineClipIndex = Math.max(0, Math.min(audioTimelineClips.length - 1, wasActive ? index : activeTimelineClipIndex));
        await refreshTimelineAudioBuffer({ keepTime: false, restart: true, saveSettings: false });
        applyTimelineSettings(audioTimelineClips[activeTimelineClipIndex]?.settings);
    } else if (action === 'gapMinus') {
        setTimelineClipGap(index, (clip.gapAfterMs ?? timelineGapMs) - 10);
    } else if (action === 'gapPlus') {
        setTimelineClipGap(index, (clip.gapAfterMs ?? timelineGapMs) + 10);
    }
});

audioTimelineStrip?.addEventListener('keydown', (event) => {
    const control = event.target.closest('[data-timeline-action="appendUpload"]');
    if (!control || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    forceAppendNextUpload = Boolean(originalBuffer);
    upload?.click();
});

audioTimelineStrip?.addEventListener('input', async (event) => {
    const control = event.target.closest('[data-timeline-action]');
    if (!control) return;
    const index = Number(control.dataset.index || 0);
    const clip = audioTimelineClips[index];
    if (!clip) return;
    const action = control.dataset.timelineAction;
    if (action === 'volume') {
        clip.volume = Number(control.value || 100);
        const label = control.nextElementSibling;
        if (label) label.textContent = `${Math.round(clip.volume)}%`;
    } else if (action === 'fadeInTime') {
        clip.fadeInDuration = Math.max(0.1, Math.min(30, Number(control.value || 1)));
    } else if (action === 'fadeOutTime') {
        clip.fadeOutDuration = Math.max(0.1, Math.min(30, Number(control.value || 1)));
    } else if (action === 'gapAfter') {
        clip.gapAfterMs = Math.max(0, Math.min(10000, Math.round(Number(control.value || 0))));
    }
});

audioTimelineStrip?.addEventListener('change', async (event) => {
    const control = event.target.closest('[data-timeline-action]');
    if (!control) return;
    const index = Number(control.dataset.index || 0);
    const clip = audioTimelineClips[index];
    if (!clip) return;
    if (control.dataset.timelineAction === 'fadeInToggle') {
        clip.fadeInEnabled = control.checked;
        await refreshTimelineAudioBuffer({ keepTime: true, restart: true });
    } else if (control.dataset.timelineAction === 'fadeOutToggle') {
        clip.fadeOutEnabled = control.checked;
        await refreshTimelineAudioBuffer({ keepTime: true, restart: true });
    } else if (['volume', 'fadeInTime', 'fadeOutTime', 'gapAfter'].includes(control.dataset.timelineAction)) {
        await refreshTimelineAudioBuffer({ keepTime: true, restart: true });
    }
});

audioTimelineGapInput?.addEventListener('input', () => {
    setTimelineGapMs(audioTimelineGapInput.value, { rebuild: false });
});
audioTimelineGapInput?.addEventListener('change', () => {
    setTimelineGapMs(audioTimelineGapInput.value, { rebuild: true });
});
audioTimelineGapMinus?.addEventListener('click', () => {
    setTimelineGapMs(timelineGapMs - 100, { rebuild: true });
});
audioTimelineGapPlus?.addEventListener('click', () => {
    setTimelineGapMs(timelineGapMs + 100, { rebuild: true });
});
audioTimelineGapApplyAll?.addEventListener('click', () => {
    applyTimelineGapToAll();
});
setTimelineGapMs(timelineGapMs, { rebuild: false });

function applyDecodedAudioState(file, buffer, { mode = 'replace', resumeAt = 0, resumePlayback = false } = {}) {
    resetLoudnessStats();
    currentAudioFileBlob = audioTimelineClips.length > 1 ? null : file;
    currentAudioFileName = audioTimelineClips.length > 1 ? `${audioTimelineClips[0].name.replace(/\.[^/.]+$/, '')}_timeline` : file.name;
    updateExportFilenamePreview();
    originalBuffer = buffer;
    masteredWaveformPeaks = [];
    sectionRepeatEnabled = false;
    sectionRepeatInitialized = false;
    sectionRepeatStart = 0;
    sectionRepeatEnd = buffer.duration;
    updateSectionRepeatUI(0);
    waveformPeaks = mode === 'append' ? buildWaveformPeaks(buffer) : buildWaveformPreview(buffer);
    if (audioTimelineClips.length === 1 && audioTimelineClips[0]) {
        audioTimelineClips[0].waveformPeaks = waveformPeaks;
    }
    stopWaveformLoading(true, mode === 'append' ? `${file.name} 타임라인에 추가 완료` : `${file.name} 로드 완료`);
    const startAt = Math.max(0, Math.min(buffer.duration, resumeAt || 0));
    updateWaveformProgress(startAt);
    trackName.innerText = mode === 'append'
        ? `${audioTimelineClips.length}개 트랙 타임라인 · ${file.name}`
        : file.name;

    activeStemIds = [];
    const activeCount = Math.floor(Math.random() * 5) + 8;
    const shuffled = [...stemRegistry].sort(() => 0.5 - Math.random());
    for (let i = 0; i < activeCount; i++) activeStemIds.push(shuffled[i].id);

    // Re-initialize values for stems in audioState when new file is uploaded
    stemRegistry.forEach(s => {
        audioState.stems[s.id] = 0;
        audioState.mutes[s.id] = false;
    });

    syncStemsUI();
    disposeRealtimeAudioGraph();
    playBtn.disabled = false;
    setAudioTransportAvailability(true);

    const enableSeekBar = document.getElementById('cfg-seek-bar')?.checked !== false;
    progressBar.disabled = !enableSeekBar;
    downloadBtn.disabled = false;
    playBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    downloadBtn.classList.remove('opacity-40', 'cursor-not-allowed');

    const enableTubeExciter = document.getElementById('cfg-tube-exciter')?.checked === true;
    audioState.saturatorEnabled = enableTubeExciter;
    audioState.saturator = enableTubeExciter ? 15 : 0;

    const saturatorInput = document.getElementById('saturator-volume');
    if (saturatorInput) {
        saturatorInput.value = audioState.saturator;
        const valSpan = document.getElementById('saturator-val');
        if (valSpan) valSpan.innerText = audioState.saturator + ' %';
    }
    updateUtilityEffectToggles();
    updateCompressorRangeFills();

    if (mode === 'append') {
        applyTimelineSettings(audioTimelineClips[activeTimelineClipIndex]?.settings);
    } else if (audioTimelineClips[0]) {
        audioTimelineClips[0].settings = captureTimelineSettings();
    }

    pausedAt = startAt;
    isPlaying = false;
    setProgressBarValue(buffer.duration ? (startAt / buffer.duration) * 100 : 0);
    updateWaveformProgress(startAt);
    playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;
    renderAudioTimeline();
    if (resumePlayback) void startPlaybackAt(startAt);
}

// Audio upload completion: keep workstation-specific state in the main application.
async function handleDecodedAudio(file, buffer, { batchIndex = 0, batchTotal = 1 } = {}) {
    const hasExistingAudio = Boolean(originalBuffer);
    const isMultiUpload = batchTotal > 1;
    let mode = 'replace';
    if (hasExistingAudio && (forceAppendNextUpload || isMultiUpload)) {
        mode = 'append';
    } else if (hasExistingAudio) {
        mode = await showAudioUploadChoice(file);
    }
    forceAppendNextUpload = false;

    const resumeAt = getCurrentPlaybackTime();
    const resumePlayback = mode === 'append' && isPlaying;
    if (mode === 'append') saveActiveTimelineSettings();
    stopCurrentAudioSource(mode === 'append');

    if (mode === 'append') {
        if (!audioTimelineClips.length && originalBuffer) {
            const existingFile = currentAudioFileBlob || { name: currentAudioFileName || 'Current Audio' };
            audioTimelineClips = [createTimelineClip(existingFile, originalBuffer)];
        }
        audioTimelineClips.push(createTimelineClip(file, buffer));
        const combined = rebuildAudioTimelineBuffer();
        activeTimelineClipIndex = getTimelineClipIndexAt(resumeAt);
        applyDecodedAudioState(file, combined || buffer, { mode, resumeAt, resumePlayback });
        return;
    }

    audioTimelineClips = [createTimelineClip(file, buffer)];
    activeTimelineClipIndex = 0;
    applyDecodedAudioState(file, buffer, { mode: 'replace', resumeAt: 0, resumePlayback: false });
}

progressBar.onmousedown = () => { isUserSeeking = true; };
progressBar.onmouseup = () => { isUserSeeking = false; };
progressBar.oninput = (e) => {
    if (!originalBuffer) return;
    setProgressBarValue(parseFloat(e.target.value));
    let pct = parseFloat(e.target.value) / 100;
    let targetTime = pct * originalBuffer.duration;
    timeDisplay.innerText = formatTime(targetTime);
    updateWaveformProgress(targetTime);
};

async function seekToTime(targetTime) {
    if (!originalBuffer) return;
    const target = Math.max(0, Math.min(originalBuffer.duration, Number(targetTime) || 0));
    const wasPlaying = isPlaying;
    if (sourceNode) {
        try { sourceNode.stop(); } catch (error) {}
    }
    isPlaying = false;
    pausedAt = target;
    setProgressBarValue(originalBuffer.duration ? (target / originalBuffer.duration) * 100 : 0);
    updateWaveformProgress(target);
    updateSectionRepeatUI(target);
    if (target >= originalBuffer.duration) {
        playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;
        return;
    }
    if (wasPlaying) await startPlaybackAt(target);
}

if (skipBackBtn) skipBackBtn.onclick = () => seekToTime((isPlaying && audioCtx ? audioCtx.currentTime - startTime : pausedAt) - 10);
if (skipForwardBtn) skipForwardBtn.onclick = () => seekToTime((isPlaying && audioCtx ? audioCtx.currentTime - startTime : pausedAt) + 10);
if (seekStartBtn) seekStartBtn.onclick = () => seekToTime(0);
if (seekEndBtn) seekEndBtn.onclick = () => seekToTime(originalBuffer?.duration || 0);
if (trackPrevBtn) trackPrevBtn.onclick = () => setActiveTimelineClip(activeTimelineClipIndex - 1);
if (trackNextBtn) trackNextBtn.onclick = () => setActiveTimelineClip(activeTimelineClipIndex + 1);
progressBar.onchange = async (e) => {
    if (!originalBuffer) return;
    let pct = parseFloat(e.target.value) / 100;
    pausedAt = pct * originalBuffer.duration;
    updateWaveformProgress(pausedAt);
    
    if (isPlaying) {
        if (sourceNode) { try { sourceNode.stop(); } catch(err){} }
        await startPlaybackAt(pausedAt);
    }
    isUserSeeking = false;
};

function seekToWaveformEvent(e, shouldRestartPlayback = true) {
    if (!originalBuffer || !waveformCanvas || progressBar.disabled) return;
    const rect = waveformCanvas.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setProgressBarValue(pct * 100);
    progressBar.dispatchEvent(new Event('input', { bubbles: true }));
    if (shouldRestartPlayback) {
        progressBar.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

if (waveformCanvas) {
    waveformCanvas.onmousedown = (e) => {
        isUserSeeking = true;
        seekToWaveformEvent(e, false);
    };
    waveformCanvas.onmousemove = (e) => {
        if (!isUserSeeking) return;
        seekToWaveformEvent(e, false);
    };
    window.addEventListener('mouseup', (e) => {
        if (!isUserSeeking) return;
        seekToWaveformEvent(e, true);
        isUserSeeking = false;
    });
}

async function startPlaybackAt(offset = 0) {
    await ensureRealtimeAudioGraph();
    if (sourceNode) {
        try { sourceNode.onended = null; } catch (error) {}
        try { sourceNode.disconnect(); } catch (error) {}
    }
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = originalBuffer;
    sourceNode.connect(realtimeGraphInputNode);

    bindLiveControlTriggers();

    const repeatOffset = sectionRepeatEnabled && sectionRepeatEnd > sectionRepeatStart && offset >= sectionRepeatEnd
        ? sectionRepeatStart
        : offset;
    pausedAt = Math.max(0, Math.min(repeatOffset, originalBuffer.duration));
    startTime = audioCtx.currentTime - pausedAt;
    sourceNode.start(0, pausedAt);
    isPlaying = true;
    playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;

    sourceNode.onended = async () => {
        if (!isPlaying || audioCtx.currentTime - startTime < originalBuffer.duration - 0.1) return;

        if (sectionRepeatEnabled && sectionRepeatEnd > sectionRepeatStart) {
            pausedAt = sectionRepeatStart;
            updateWaveformProgress(sectionRepeatStart);
            await startPlaybackAt(sectionRepeatStart);
            return;
        }

        if (isLooping) {
            pausedAt = 0;
            updateWaveformProgress(0);
            await startPlaybackAt(0);
            return;
        }

        isPlaying = false;
        pausedAt = 0;
        playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;
        updateWaveformProgress(0);
    };
}

async function ensureRealtimeAudioGraph() {
    if (realtimeGraphInputNode && realtimeGraphOutputNode) return realtimeGraphOutputNode;
    if (realtimeGraphPromise) return realtimeGraphPromise;
    realtimeGraphPromise = (async () => {
        performance.mark('audio-graph-build-start');
        const inputNode = audioCtx.createGain();
        const finalizedOutput = await compileAudioGraph(audioCtx, inputNode);
        realtimeGraphInputNode = inputNode;
        realtimeGraphOutputNode = finalizedOutput;
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.78;
        analyserNode.minDecibels = SPECTRUM_MIN_DB;
        analyserNode.maxDecibels = SPECTRUM_MAX_DB;

        finalizedOutput.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);

        // Read the post-pan left/right channels without adding a second audible path.
        levelSplitterNode = audioCtx.createChannelSplitter(2);
        levelLeftAnalyser = audioCtx.createAnalyser();
        levelRightAnalyser = audioCtx.createAnalyser();
        levelLeftAnalyser.fftSize = 256;
        levelRightAnalyser.fftSize = 256;
        levelSilentGain = audioCtx.createGain();
        levelSilentGain.gain.value = 0;
        finalizedOutput.connect(levelSplitterNode);
        levelSplitterNode.connect(levelLeftAnalyser, 0);
        levelSplitterNode.connect(levelRightAnalyser, 1);
        levelLeftAnalyser.connect(levelSilentGain);
        levelRightAnalyser.connect(levelSilentGain);
        levelSilentGain.connect(audioCtx.destination);

        performance.mark('audio-graph-build-end');
        performance.measure('audio-graph-build', 'audio-graph-build-start', 'audio-graph-build-end');
        return finalizedOutput;
    })().catch((error) => {
        disposeRealtimeAudioGraph();
        throw error;
    }).finally(() => {
        realtimeGraphPromise = null;
    });
    return realtimeGraphPromise;
}

function disposeRealtimeAudioGraph() {
    for (const node of [realtimeGraphInputNode, realtimeGraphOutputNode, analyserNode, levelSplitterNode, levelLeftAnalyser, levelRightAnalyser, levelSilentGain]) {
        try { node?.disconnect(); } catch (error) {}
    }
    realtimeGraphInputNode = null;
    realtimeGraphOutputNode = null;
    analyserNode = null;
    levelSplitterNode = null;
    levelLeftAnalyser = null;
    levelRightAnalyser = null;
    levelSilentGain = null;
    spectrumDataArray = null;
}

if (loopBtn) {
    loopBtn.onclick = () => {
        isLooping = !isLooping;
        updateLoopButton();
    };
}
updateLoopButton();

playBtn.onclick = async () => {
    if (!originalBuffer) return;

    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    if (isPlaying) {
        if(sourceNode) { try { sourceNode.stop(); } catch(e){} }
        pausedAt = audioCtx.currentTime - startTime;
        isPlaying = false;
        playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;
    } else {
        if (pausedAt >= originalBuffer.duration) pausedAt = 0;
        await startPlaybackAt(pausedAt);
    }
};

setInterval(() => {
    if (!originalBuffer || !audioCtx) return;
    let current = isPlaying ? (audioCtx.currentTime - startTime) : pausedAt;
    if (current > originalBuffer.duration) current = originalBuffer.duration;
    if (current < 0) current = 0;

    if (sectionRepeatEnabled && isPlaying && sectionRepeatEnd > sectionRepeatStart && current >= sectionRepeatEnd && !sectionRepeatSeeking) {
        sectionRepeatSeeking = true;
        void seekToTime(sectionRepeatStart).finally(() => { sectionRepeatSeeking = false; });
        return;
    }
    
    timeDisplay.innerText = formatTime(current);
    updateWaveformProgress(current);
    updateSectionRepeatUI(current);
    
    if (!isUserSeeking && progressBar) {
        setProgressBarValue((current / originalBuffer.duration) * 100);
    }
}, 250);

// A/B bypass routing switch
const btnA = document.getElementById('bypass-a');
const btnB = document.getElementById('bypass-b');
function enableMasterProcessors() {
    audioState.compressor.enabled = true;
    audioState.limiter.enabled = true;
    compressor.updateUI(updateCompressorRangeFills);
    limiter.updateUI(updateCompressorRangeFills);
}

function executeBypassRouting(mode) {
    isBypassed = mode;
    if (isBypassed) {
        btnA.className = "is-active";
        btnB.className = "";
        if (isPlaying) {
            eq.applySettings(audioCtx, isBypassed);
            saturation.applySettings(audioCtx, () => isBypassed);
            spread.applySettings(audioCtx, () => isBypassed);
            Object.values(stemFilters).forEach(f => f.gain.setValueAtTime(0, audioCtx.currentTime));
            applyUtilityEffectSettings(audioCtx);
            reverb.applySettings(audioCtx, () => isBypassed);
            compressor.applySettings(audioCtx, () => isBypassed);
            limiter.applySettings(audioCtx, () => isBypassed);
            if(masterGainNode) masterGainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
            applySpatialSettings();
        }
    } else {
        btnA.className = "";
        btnB.className = "is-active";
        if (isPlaying) {
            eq.applySettings(audioCtx, isBypassed);
            saturation.applySettings(audioCtx, () => isBypassed);
            spread.applySettings(audioCtx, () => isBypassed);
            const stemsDisabled = isBypassed || !audioState.stemsEnabled;
            stemRegistry.forEach(stem => {
                if (activeStemIds.includes(stem.id) && stemFilters[stem.id]) {
                    const gainVal = stemsDisabled ? 0 : (audioState.mutes[stem.id] ? -40 : audioState.stems[stem.id]);
                    stemFilters[stem.id].gain.setValueAtTime(gainVal, audioCtx.currentTime);
                }
            });
            applyUtilityEffectSettings(audioCtx);
            reverb.applySettings(audioCtx, () => isBypassed);
            compressor.applySettings(audioCtx, () => isBypassed);
            limiter.applySettings(audioCtx, () => isBypassed);
            if(masterGainNode) masterGainNode.gain.setValueAtTime(audioState.master / 100, audioCtx.currentTime);
            applySpatialSettings();
        }
    }
    drawAudioWaveform(waveformProgress);
}
btnA.onclick = () => executeBypassRouting(true);
btnB.onclick = () => {
    if (!hasWaveformEnvelope(waveformPeaks) && originalBuffer) {
        waveformPeaks = buildWaveformPreview(originalBuffer);
        if (audioTimelineClips.length === 1 && audioTimelineClips[0]) {
            audioTimelineClips[0].waveformPeaks = waveformPeaks;
        }
    }
    enableMasterProcessors();
    executeBypassRouting(false);
};

function convertAudioBufferToWavBlob(buffer) {
    let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(length), view = new DataView(bufferArr),
        channels = [], i, sample, offset = 0, pos = 0;
    const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };
    const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66);
    setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16);
    setUint32(0x61746164); setUint32(length - pos - 4);
    for (i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true); pos += 2;
        }
        offset++;
    }
    return new Blob([bufferArr], { type: 'audio/wav' });
}

// Lossless bounce export
if (exportCancelBtn) {
    exportCancelBtn.onclick = () => {
        if (!activeExportJob) return;
        activeExportJob.cancelled = true;
        if (activeExportJob.timer) window.clearInterval(activeExportJob.timer);
        if (exportCancelBtn) exportCancelBtn.disabled = true;
        setExportProgress(activeExportJob.lastProgress || 0, 'WAV 내보내기 중지됨');
        trackName.innerText = "WAV 내보내기가 중지되었습니다.";
        activeExportJob = null;
        setDownloadButtonEnabled(Boolean(originalBuffer));
        hideExportProgress(1000);
    };
}

async function executeMasteredExport({ download = true, jjimTarget = null } = {}) {
    if (!originalBuffer || activeExportJob) return;
    const exportFilename = getMasteredExportFilename();

    const job = {
        id: Date.now(),
        cancelled: false,
        timer: null,
        lastProgress: 0
    };
    activeExportJob = job;

    trackName.innerText = "WAV 내보내기를 백그라운드에서 시작했습니다.";
    setDownloadButtonEnabled(false);
    showExportProgress('WAV 렌더링 준비 중');

    try {
        const offlineCtx = new OfflineAudioContext(
            originalBuffer.numberOfChannels,
            originalBuffer.length,
            originalBuffer.sampleRate
        );

        const offlineSource = offlineCtx.createBufferSource();
        offlineSource.buffer = originalBuffer;

        const offlineOutput = await compileAudioGraph(offlineCtx, offlineSource, { isolated: true });
        if (job.cancelled) return;

        offlineOutput.connect(offlineCtx.destination);
        offlineSource.start(0);

        const renderDuration = originalBuffer.duration || 1;
        job.timer = window.setInterval(() => {
            if (job.cancelled) return;
            const renderPercent = Math.min(94, (offlineCtx.currentTime / renderDuration) * 94);
            job.lastProgress = renderPercent;
            setExportProgress(renderPercent, 'WAV 렌더링 중');
        }, 100);

        const renderedBuffer = await offlineCtx.startRendering();
        if (job.timer) window.clearInterval(job.timer);
        if (job.cancelled || activeExportJob !== job) return;

        setExportProgress(96, 'WAV 파일 생성 중');
        masteredWaveformPeaks = buildWaveformPeaks(renderedBuffer);
        drawAudioWaveform(waveformProgress);
        const wavBlob = convertAudioBufferToWavBlob(renderedBuffer);
        if (window.jjimHandoff) {
            await window.jjimHandoff.setMasteredAudio({
                blob: wavBlob,
                filename: exportFilename,
                metrics: {
                    duration: renderedBuffer.duration,
                    sampleRate: renderedBuffer.sampleRate,
                    channels: renderedBuffer.numberOfChannels
                }
            });
        }
        if (download) {
            const url = URL.createObjectURL(wavBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = exportFilename;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        if (jjimTarget) await window.jjimHandoff?.send(jjimTarget, { variant: 'mastered' });
        window.jjimHandoff?.showMasteredDialog();

        setExportProgress(100, jjimTarget ? '짜임새 전송 준비 완료' : '마스터 WAV 렌더링 완료');
        trackName.innerText = jjimTarget
            ? '마스터 WAV를 만들고 짜임새 입력 화면으로 전달했습니다.'
            : '렌더링 완료: 플레이어 전송 또는 PC 다운로드를 선택하세요.';
        activeExportJob = null;
        setDownloadButtonEnabled(Boolean(originalBuffer));
        hideExportProgress(1200);
    } catch (err) {
        if (job.timer) window.clearInterval(job.timer);
        if (activeExportJob === job) activeExportJob = null;
        setExportProgress(job.lastProgress || 0, 'WAV 내보내기 실패');
        alert(err?.message || "인코딩 중 에러가 발생했습니다.");
        setDownloadButtonEnabled(Boolean(originalBuffer));
        hideExportProgress(1600);
    }
}

downloadBtn.onclick = () => executeMasteredExport({ download: false });
if (audioDownloadBtn) audioDownloadBtn.onclick = () => executeMasteredExport({ download: true });

function formatSpectrumFrequency(frequency) {
    if (frequency >= 1000) {
        const kilo = frequency / 1000;
        return `${kilo >= 10 ? Math.round(kilo) : kilo.toFixed(1).replace('.0', '')}k`;
    }
    return String(Math.round(frequency));
}

function collectSpectrumBands(dataArray, count) {
    const sampleRate = analyserNode?.context?.sampleRate || 48000;
    const fftSize = analyserNode?.fftSize || dataArray.length * 2;
    const binHz = sampleRate / fftSize;
    const minHz = 31.5;
    const maxHz = Math.min(20000, sampleRate / 2);
    const ratio = maxHz / minHz;

    return Array.from({ length: count }, (_, index) => {
        const startHz = minHz * Math.pow(ratio, index / count);
        const endHz = minHz * Math.pow(ratio, (index + 1) / count);
        const startBin = Math.max(1, Math.min(dataArray.length - 1, Math.floor(startHz / binHz)));
        const endBin = Math.max(startBin + 1, Math.min(dataArray.length, Math.ceil(endHz / binHz)));
        let peak = 0;
        let energy = 0;
        let samples = 0;
        for (let bin = startBin; bin < endBin; bin++) {
            const value = dataArray[bin];
            peak = Math.max(peak, value);
            energy += value * value;
            samples++;
        }
        const rms = Math.sqrt(energy / Math.max(1, samples));
        return {
            frequency: Math.sqrt(startHz * endHz),
            percent: Math.min(1, ((peak * 0.72) + (rms * 0.28)) / 255)
        };
    });
}

const SPECTRUM_MIN_DB = -72;
const SPECTRUM_MAX_DB = 0;

function getSpectrumPlotRect() {
    const left = 32;
    const right = 6;
    const top = 24;
    const bottom = 8;
    return {
        left,
        top,
        right: canvas.width - right,
        bottom: canvas.height - bottom,
        width: Math.max(1, canvas.width - left - right),
        height: Math.max(1, canvas.height - top - bottom)
    };
}

function drawSpectrumDbScale() {
    const plot = getSpectrumPlotRect();
    const ticks = [0, -12, -24, -36, -48, -60, -72];
    ctx.save();
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ticks.forEach((db) => {
        const ratio = (db - SPECTRUM_MIN_DB) / (SPECTRUM_MAX_DB - SPECTRUM_MIN_DB);
        const y = plot.bottom - ratio * plot.height;
        ctx.strokeStyle = db === 0 ? 'rgba(251,113,133,.28)' : 'rgba(71,85,105,.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.right, y); ctx.stroke();
        ctx.fillStyle = db === 0 ? '#fb7185' : '#64748b';
        ctx.fillText(`${db}`, plot.left - 5, y);
    });
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText('dB', 3, plot.top - 10);
    for (let index = 0; index <= 10; index++) {
        const x = plot.left + plot.width * index / 10;
        ctx.strokeStyle = 'rgba(71,85,105,.13)';
        ctx.beginPath(); ctx.moveTo(x, plot.top); ctx.lineTo(x, plot.bottom); ctx.stroke();
    }
    ctx.restore();
}

function drawSpectrumFrequencyLabels(bands) {
    const plot = getSpectrumPlotRect();
    const labelStep = Math.max(1, Math.ceil(bands.length / 10));
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    bands.forEach((band, index) => {
        if (index % labelStep !== 0 && index !== bands.length - 1) return;
        const x = plot.left + ((index + 0.5) / bands.length) * plot.width;
        ctx.fillText(formatSpectrumFrequency(band.frequency), x, 10);
    });
    ctx.restore();
}

function drawBarSpectrum(bands) {
    const plot = getSpectrumPlotRect();
    const slotWidth = plot.width / bands.length;
    const gap = Math.max(1, Math.min(4, slotWidth * 0.16));
    const barWidth = Math.max(1, slotWidth - gap);
    bands.forEach((band, index) => {
        const barHeight = band.percent * plot.height;
        const x = plot.left + (index * slotWidth) + (gap / 2);
        const y = plot.bottom - barHeight;
        const gradient = ctx.createLinearGradient(0, y, 0, plot.bottom);
        gradient.addColorStop(0, '#f43f5e');
        gradient.addColorStop(0.4, '#fbbf24');
        gradient.addColorStop(1, '#10b981');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
    });
    drawSpectrumFrequencyLabels(bands);
}

function drawWaveSpectrum(bands, overlay = false) {
    const plot = getSpectrumPlotRect();
    const points = bands.map((band, index) => ({
        x: plot.left + ((index + 0.5) / bands.length) * plot.width,
        y: plot.bottom - (band.percent * plot.height)
    }));
    if (!points.length) return;

    if (!overlay) {
        const fillGradient = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
        fillGradient.addColorStop(0, 'rgba(244,63,94,.58)');
        fillGradient.addColorStop(0.42, 'rgba(251,191,36,.36)');
        fillGradient.addColorStop(1, 'rgba(16,185,129,.08)');
        ctx.beginPath();
        ctx.moveTo(points[0].x, plot.bottom);
        points.forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, plot.bottom);
        ctx.closePath();
        ctx.fillStyle = fillGradient;
        ctx.fill();
    }

    const lineGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    lineGradient.addColorStop(0, '#10b981');
    lineGradient.addColorStop(0.55, '#22d3ee');
    lineGradient.addColorStop(1, '#fb7185');
    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = overlay ? 2.6 : 2.2;
    ctx.shadowColor = 'rgba(34,211,238,.65)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (bands.length <= 32) {
        ctx.fillStyle = '#e0f2fe';
        points.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    if (!overlay) drawSpectrumFrequencyLabels(bands);
}

let spectrumLastFrameAt = 0;
let spectrumIdleDrawn = false;
function animateSpectrum(now = 0) {
    requestAnimationFrame(animateSpectrum);
    if (document.hidden || now - spectrumLastFrameAt < 33) return;
    spectrumLastFrameAt = now;
    updateOutputLevelMeter();
    updateMasterLoudnessMeter();
    if(!canvas || !ctx) return;

    if (!analyserNode || !isPlaying) {
        if (spectrumIdleDrawn) return;
        spectrumIdleDrawn = true;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawSpectrumDbScale();
        const plot = getSpectrumPlotRect();
        ctx.beginPath(); ctx.lineWidth = 2; ctx.strokeStyle = '#1e293b';
        ctx.moveTo(plot.left, plot.bottom); ctx.lineTo(plot.right, plot.bottom); ctx.stroke();
        
        if(lufsBar) lufsBar.style.width = "0%";
        if(lufsText) lufsText.innerText = "-inf dB";
        if(compGrBar) compGrBar.style.width = "0%";
        if(compGrVal) compGrVal.innerText = "0.0 dB";
        if(clipLed) clipLed.classList.remove('clip-active');
        return;
    }
    spectrumIdleDrawn = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSpectrumDbScale();

    const bufferLength = analyserNode.frequencyBinCount;
    if (!spectrumDataArray || spectrumDataArray.length !== bufferLength) spectrumDataArray = new Uint8Array(bufferLength);
    analyserNode.getByteFrequencyData(spectrumDataArray);
    const spectrumBands = collectSpectrumBands(spectrumDataArray, spectrumBandCount);
    if (spectrumViewMode === 'wave') {
        drawWaveSpectrum(spectrumBands);
    } else if (spectrumViewMode === 'combo') {
        drawBarSpectrum(spectrumBands);
        drawWaveSpectrum(spectrumBands, true);
    } else {
        drawBarSpectrum(spectrumBands);
    }

    const rms = Math.sqrt(spectrumBands.reduce((sum, band) => sum + (band.percent * band.percent), 0) / Math.max(1, spectrumBands.length));
    const dbLevel = Math.round(20 * Math.log10(rms + 0.0001));
    const displayPercent = Math.max(0, Math.min(100, (dbLevel + 40) * 2.5)); 

    if(lufsBar) lufsBar.style.width = displayPercent + "%";
    if(lufsText) lufsText.innerText = (dbLevel >= 0 ? "0" : dbLevel) + " dB";

    const reduction = compressor.dynamicCompressorNode && audioState.compressor.enabled && !isBypassed
        ? Math.abs(compressor.dynamicCompressorNode.reduction || 0)
        : 0;
    if(compGrBar) compGrBar.style.width = Math.min(100, (reduction / 24) * 100) + "%";
    if(compGrVal) compGrVal.innerText = reduction.toFixed(1) + " dB";

    limiter.updateMeters(getBypassState);

    if(dbLevel >= -1) {
        if(clipLed) clipLed.classList.add('clip-active');
    } else {
        if(clipLed) clipLed.classList.remove('clip-active');
    }
}

function handleResize() {
    const spectrumRect = canvas.getBoundingClientRect();
    canvas.width = Math.max(260, Math.round(spectrumRect.width));
    canvas.height = Math.max(120, Math.round(spectrumRect.height));
    compressor.drawCurve();
    reverb.updateReverbVisualizers?.();
    limiter.updateLimiterVisualizers?.();
    drawAudioWaveform(waveformProgress);
    drawLoudnessHistory();
}

const SPECTRUM_PANEL_HEIGHT_STORAGE_KEY = 'jd-spectrum-panel-height';
function setupSpectrumHeightResize() {
    if (!spectrumAnalyzerPanel || !spectrumHeightResizer) return;
    try {
        const storedHeight = Number(localStorage.getItem(SPECTRUM_PANEL_HEIGHT_STORAGE_KEY));
        if (Number.isFinite(storedHeight) && storedHeight >= 220 && storedHeight <= 620) {
            spectrumAnalyzerPanel.style.height = `${storedHeight}px`;
        }
    } catch (error) {}
    let startY = 0;
    let startHeight = 0;
    const finish = (event) => {
        if (!spectrumHeightResizer.classList.contains('is-resizing')) return;
        spectrumHeightResizer.classList.remove('is-resizing');
        if (spectrumHeightResizer.hasPointerCapture?.(event.pointerId)) spectrumHeightResizer.releasePointerCapture(event.pointerId);
        try { localStorage.setItem(SPECTRUM_PANEL_HEIGHT_STORAGE_KEY, String(Math.round(spectrumAnalyzerPanel.getBoundingClientRect().height))); } catch (error) {}
        handleResize();
    };
    spectrumHeightResizer.onpointerdown = (event) => {
        event.preventDefault();
        startY = event.clientY;
        startHeight = spectrumAnalyzerPanel.getBoundingClientRect().height;
        spectrumHeightResizer.classList.add('is-resizing');
        spectrumHeightResizer.setPointerCapture?.(event.pointerId);
    };
    spectrumHeightResizer.onpointermove = (event) => {
        if (!spectrumHeightResizer.classList.contains('is-resizing')) return;
        spectrumAnalyzerPanel.style.height = `${Math.max(220, Math.min(620, startHeight + event.clientY - startY))}px`;
        handleResize();
    };
    spectrumHeightResizer.onpointerup = finish;
    spectrumHeightResizer.onpointercancel = finish;
}

window.addEventListener('resize', handleResize);
setupSpectrumHeightResize();
handleResize();
drawAudioWaveform(0);
animateSpectrum();

// ==========================================
// IndexedDB & JJD Project Management Core
// ==========================================

const DB_NAME = 'JdMasteringStudioDB';
const STORE_NAME = 'projects';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveProject(name, audioBlob, audioFileName, activeStemIds, audioState, effectorSettings, audioTimeline = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const requestGetAll = store.getAll();
        requestGetAll.onsuccess = () => {
            const projects = requestGetAll.result;
            const existing = projects.find(p => p.name === name);
            const project = {
                name,
                timestamp: Date.now(),
                audioBlob,
                audioFileName,
                activeStemIds,
                audioState: JSON.parse(JSON.stringify(audioState)),
                effectors: effectorSettings,
                audioTimeline
            };
            if (existing) {
                project.id = existing.id; // Overwrite
            }
            const requestPut = store.put(project);
            requestPut.onsuccess = () => resolve(requestPut.result);
            requestPut.onerror = (e) => reject(e.target.error);
        };
        requestGetAll.onerror = (e) => reject(e.target.error);
    });
}

async function getProjects() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getProject(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

const effectorRegistry = { eq, saturation, spread, reverb, compressor, limiter };

function serializeEffectorSettings() {
    const effectorSettings = {};
    for (const [key, effector] of Object.entries(effectorRegistry)) {
        if (typeof effector.getSettings === 'function') {
            effectorSettings[key] = effector.getSettings();
        }
    }
    return effectorSettings;
}

function serializeAudioTimelineProject() {
    saveActiveTimelineSettings();
    return {
        activeIndex: activeTimelineClipIndex,
        gapMs: timelineGapMs,
        clips: audioTimelineClips.map((clip) => ({
            name: clip.name,
            fileBlob: clip.file instanceof Blob ? clip.file : null,
            volume: clip.volume ?? 100,
            gapAfterMs: Number(clip.gapAfterMs ?? timelineGapMs),
            fadeInEnabled: Boolean(clip.fadeInEnabled),
            fadeInDuration: Number(clip.fadeInDuration ?? 1),
            fadeOutEnabled: Boolean(clip.fadeOutEnabled),
            fadeOutDuration: Number(clip.fadeOutDuration ?? 1),
            settings: clip.settings || captureTimelineSettings()
        }))
    };
}

async function decodeTimelineClipFromProject(savedClip) {
    if (!savedClip?.fileBlob) return null;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const arrayBuffer = await savedClip.fileBlob.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    return {
        id: `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file: savedClip.fileBlob,
        name: savedClip.name || 'Audio Clip',
        buffer,
        start: 0,
        duration: buffer.duration,
        volume: savedClip.volume ?? 100,
        gapAfterMs: Number(savedClip.gapAfterMs ?? timelineGapMs),
        fadeInEnabled: Boolean(savedClip.fadeInEnabled),
        fadeInDuration: Number(savedClip.fadeInDuration ?? 1),
        fadeOutEnabled: Boolean(savedClip.fadeOutEnabled),
        fadeOutDuration: Number(savedClip.fadeOutDuration ?? 1),
        settings: savedClip.settings || captureTimelineSettings()
    };
}

async function restoreAudioTimelineProject(audioTimeline) {
    const clips = [];
    for (const savedClip of audioTimeline?.clips || []) {
        const clip = await decodeTimelineClipFromProject(savedClip);
        if (clip) clips.push(clip);
    }
    if (!clips.length) return false;

    setTimelineGapMs(audioTimeline.gapMs ?? 2000, { rebuild: false });
    audioTimelineClips = clips;
    activeTimelineClipIndex = Math.max(0, Math.min(clips.length - 1, Number(audioTimeline.activeIndex) || 0));
    const combined = rebuildAudioTimelineBuffer();
    if (!combined) return false;

    currentAudioFileBlob = clips.length === 1 ? clips[0].file : null;
    currentAudioFileName = clips.length > 1
        ? `${clips[0].name.replace(/\.[^/.]+$/, '')}_timeline`
        : clips[0].name;
    originalBuffer = combined;
    masteredWaveformPeaks = [];
    sectionRepeatEnabled = false;
    sectionRepeatInitialized = false;
    sectionRepeatStart = 0;
    sectionRepeatEnd = combined.duration;
    waveformPeaks = buildWaveformPeaks(combined);
    pausedAt = audioTimelineClips[activeTimelineClipIndex]?.start || 0;
    isPlaying = false;
    updateExportFilenamePreview();
    updateSectionRepeatUI(pausedAt);
    setProgressBarValue(combined.duration ? (pausedAt / combined.duration) * 100 : 0);
    updateWaveformProgress(pausedAt);
    renderAudioTimeline();
    trackName.innerText = clips.length > 1
        ? `${clips.length}개 트랙 타임라인 · ${audioTimelineClips[activeTimelineClipIndex]?.name || clips[0].name}`
        : clips[0].name;
    playBtn.disabled = false;
    setAudioTransportAvailability(true);
    progressBar.disabled = document.getElementById('cfg-seek-bar')?.checked === false;
    downloadBtn.disabled = false;
    playBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    downloadBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;
    applyTimelineSettings(audioTimelineClips[activeTimelineClipIndex]?.settings);
    return true;
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        if (!(blob instanceof Blob)) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.includes(',')) return null;
    const [header, base64] = dataUrl.split(',');
    const mime = /data:([^;]+)/.exec(header)?.[1] || 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

async function serializeAudioTimelineForFile() {
    const timeline = serializeAudioTimelineProject();
    const clips = [];
    for (const clip of timeline.clips) {
        clips.push({
            ...clip,
            fileBlob: undefined,
            fileDataUrl: await blobToDataUrl(clip.fileBlob),
            fileType: clip.fileBlob?.type || 'audio/*'
        });
    }
    return { activeIndex: timeline.activeIndex, gapMs: timeline.gapMs, clips };
}

function hydrateAudioTimelineFromFile(audioTimeline) {
    if (!audioTimeline?.clips) return null;
    return {
        activeIndex: audioTimeline.activeIndex,
        gapMs: audioTimeline.gapMs,
        clips: audioTimeline.clips.map((clip) => ({
            ...clip,
            fileBlob: dataUrlToBlob(clip.fileDataUrl)
        }))
    };
}

function applyAllLoadedSettings() {
    // 1. Sync EQ UI
    eq.renderUI('eq-sliders-container');
    eq.bindLiveControls(audioCtx, getPlayState, getBypassState);
    eq.updateUI();

    // Sync Preset Library Selection
    document.querySelectorAll('#genre-grid button').forEach(b => b.classList.remove('genre-active'));
    const isFlat = audioState.eq.every(val => val === 0);
    if (isFlat) {
        const noneBtnEl = document.querySelector('#genre-grid button');
        if (noneBtnEl) noneBtnEl.classList.add('genre-active');
    }

    // 2. Sync Reverb UI
    reverb.syncInputs();
    const reverbPresetSelect = document.getElementById('reverb-preset');
    if (reverbPresetSelect) reverbPresetSelect.value = "";
    reverb.updateUI(updateCompressorRangeFills);

    // 3. Sync Compressor UI
    compressor.syncInputs();
    const compTemplateSelect = document.getElementById('comp-template-select');
    if (compTemplateSelect) compTemplateSelect.value = "";
    compressor.updateUI(updateCompressorRangeFills);

    // 4. Sync Limiter UI
    if (typeof limiter.syncInputs === 'function') {
        limiter.syncInputs();
    }
    limiter.updateUI(updateCompressorRangeFills);

    // 5. Sync Saturation UI
    saturation.syncInputs();
    saturation.updateUI(updateCompressorRangeFills);

    // 6. Sync Spread UI
    spread.syncInputs();
    const spreadPresetSelect = document.getElementById('spread-preset');
    if (spreadPresetSelect) spreadPresetSelect.value = "";
    spread.updateUI(updateCompressorRangeFills);

    // 7. Sync post-eq utility effects values
    const noiseInput = document.getElementById('noise-reducer');
    if (noiseInput) {
        noiseInput.value = audioState.noise;
        const valSpan = document.getElementById('noise-val');
        if (valSpan) valSpan.innerText = audioState.noise + ' %';
    }
    const deesserInput = document.getElementById('deesser-reducer');
    if (deesserInput) {
        deesserInput.value = audioState.deesser;
        const valSpan = document.getElementById('deesser-val');
        if (valSpan) valSpan.innerText = audioState.deesser + ' %';
    }
    const saturatorInput = document.getElementById('saturator-volume');
    if (saturatorInput) {
        saturatorInput.value = audioState.saturator;
        const valSpan = document.getElementById('saturator-val');
        if (valSpan) valSpan.innerText = audioState.saturator + ' %';
    }
    const masterInput = document.getElementById('master-volume');
    if (masterInput) {
        masterInput.value = audioState.master;
        const valSpan = document.getElementById('master-val');
        if (valSpan) valSpan.innerText = audioState.master + ' %';
        updateRangeFill(masterInput, '#f43f5e');
    }
    syncSpatialUI();

    // Update toggles
    updateUtilityEffectToggles();
    updateStemsToggleUI();

    // 7. Sync Stems
    syncStemsUI();

    // 8. Update compressor/reverb/limiter/saturation range fills
    updateCompressorRangeFills();

    // 9. If AudioContext is playing, apply settings live
    if (isPlaying && audioCtx) {
        eq.applySettings(audioCtx, isBypassed);
        saturation.applySettings(audioCtx, () => isBypassed);
        spread.applySettings(audioCtx, () => isBypassed);
        
        const stemsDisabled = isBypassed || !audioState.stemsEnabled;
        stemRegistry.forEach(stem => {
            if (activeStemIds.includes(stem.id) && stemFilters[stem.id]) {
                const gainVal = stemsDisabled ? 0 : (audioState.mutes[stem.id] ? -40 : audioState.stems[stem.id]);
                stemFilters[stem.id].gain.setValueAtTime(gainVal, audioCtx.currentTime);
            }
        });
        
        applyUtilityEffectSettings(audioCtx);
        reverb.applySettings(audioCtx, () => isBypassed, true);
        compressor.applySettings(audioCtx, () => isBypassed);
        limiter.applySettings(audioCtx, () => isBypassed);
        if (masterGainNode) {
            masterGainNode.gain.setValueAtTime(audioState.master / 100, audioCtx.currentTime);
        }
        applySpatialSettings();
    }
}

async function updateProjectDropdown() {
    const select = document.getElementById('project-load-db');
    if (!select) return;
    try {
        const projects = await getProjects();
        // Clear all except first option
        select.innerHTML = '<option value="">DB 불러오기...</option>';
        projects.forEach(p => {
            const dateStr = new Date(p.timestamp).toLocaleDateString() + ' ' + new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${dateStr})`;
            select.appendChild(opt);
        });
    } catch(err) {
        console.error("Failed to load projects list", err);
    }
}

// Bind UI actions
const dbSaveBtn = document.getElementById('project-save-db');
if (dbSaveBtn) {
    dbSaveBtn.onclick = async () => {
        const defaultName = currentAudioFileName 
            ? currentAudioFileName.replace(/\.[^/.]+$/, "") + "_project" 
            : `Project_${new Date().toLocaleDateString()}`;
        const name = prompt("저장할 프로젝트 이름을 입력하세요:", defaultName);
        if (!name || !name.trim()) return;

        try {
            const settings = serializeEffectorSettings();
            await saveProject(name.trim(), currentAudioFileBlob, currentAudioFileName, activeStemIds, audioState, settings, serializeAudioTimelineProject());
            alert("프로젝트가 IndexedDB에 정상적으로 저장되었습니다.");
            await updateProjectDropdown();
        } catch(err) {
            console.error(err);
            alert("프로젝트 저장에 실패했습니다: " + err.message);
        }
    };
}

const dbLoadSelect = document.getElementById('project-load-db');
if (dbLoadSelect) {
    dbLoadSelect.onchange = async (e) => {
        const val = e.target.value;
        if (!val) return;
        const id = Number(val);
        
        trackName.innerText = "📥 프로젝트 복구 및 데이터 디코딩 중...";
        detectorStatus.innerText = "(로딩 중)";

        try {
            const project = await getProject(id);
            if (!project) return;

            // Stop playback if playing
            stopCurrentAudioSource(false);

            // Restore activeStemIds
            activeStemIds = project.activeStemIds || [];

            // Restore audioState
            if (project.audioState) {
                Object.assign(audioState, project.audioState);
            }

            // Restore effectors
            if (project.effectors) {
                for (const [key, effector] of Object.entries(effectorRegistry)) {
                    if (project.effectors[key] && typeof effector.setSettings === 'function') {
                        effector.setSettings(project.effectors[key]);
                    }
                }
            }

            if (project.audioTimeline?.clips?.length) {
                const restored = await restoreAudioTimelineProject(project.audioTimeline);
                if (restored) return;
            }

            // Restore Audio Binary (Blob)
            if (project.audioBlob) {
                currentAudioFileBlob = project.audioBlob;
                currentAudioFileName = project.audioFileName || "Loaded Project Audio";
                updateExportFilenamePreview();
                trackName.innerText = `곡명: ${currentAudioFileName}`;
                
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') await audioCtx.resume();

                const reader = new FileReader();
                reader.onload = function(evt) {
                    audioCtx.decodeAudioData(evt.target.result, function(buffer) {
                        resetLoudnessStats();
                        originalBuffer = buffer;
                        masteredWaveformPeaks = [];
                        audioTimelineClips = [createTimelineClip({ name: currentAudioFileName }, buffer)];
                        activeTimelineClipIndex = 0;
                        renderAudioTimeline();
                        sectionRepeatEnabled = false;
                        sectionRepeatInitialized = false;
                        sectionRepeatStart = 0;
                        sectionRepeatEnd = buffer.duration;
                        updateSectionRepeatUI(0);
                        waveformPeaks = buildWaveformPeaks(buffer);
                        updateWaveformProgress(0);

                        playBtn.disabled = false;
                        setAudioTransportAvailability(true);
                        progressBar.disabled = false; 
                        downloadBtn.disabled = false;
                        playBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                        downloadBtn.classList.remove('opacity-40', 'cursor-not-allowed');

                        pausedAt = 0;
                        isPlaying = false;
                        setProgressBarValue(0);
                        updateWaveformProgress(0);
                        playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;

                        // Sync everything!
                        applyAllLoadedSettings();
                    }, function(err) {
                        alert("저장된 음원 디코딩에 실패했습니다.");
                    });
                };
                reader.readAsArrayBuffer(project.audioBlob);
            } else {
                // No audio binary
                currentAudioFileBlob = null;
                currentAudioFileName = "";
                originalBuffer = null;
                masteredWaveformPeaks = [];
                audioTimelineClips = [];
                activeTimelineClipIndex = 0;
                renderAudioTimeline();
                sectionRepeatEnabled = false;
                sectionRepeatInitialized = false;
                sectionRepeatStart = 0;
                sectionRepeatEnd = 0;
                updateSectionRepeatUI(0);
                waveformPeaks = [];
                updateWaveformProgress(0);
                trackName.innerText = `Waiting for audio upload...`;
                detectorStatus.innerText = "(추출 대기 중)";

                playBtn.disabled = true;
                setAudioTransportAvailability(false);
                progressBar.disabled = true; 
                downloadBtn.disabled = true;
                playBtn.classList.add('opacity-40', 'cursor-not-allowed');
                downloadBtn.classList.add('opacity-40', 'cursor-not-allowed');

                pausedAt = 0;
                isPlaying = false;
                setProgressBarValue(0);
                playBtn.innerHTML = `<i class="fa-solid fa-play ml-0.5"></i>`;

                // Sync everything!
                applyAllLoadedSettings();
            }
        } catch(err) {
            console.error(err);
            alert("프로젝트 로드 중 오류가 발생했습니다: " + err.message);
        }
    };
}

const fileExportBtn = document.getElementById('project-export-jjd');
if (fileExportBtn) {
    fileExportBtn.onclick = async () => {
        try {
            const settings = serializeEffectorSettings();
            const projectData = {
                version: "10.0",
                timestamp: Date.now(),
                activeStemIds: activeStemIds,
                audioState: audioState,
                effectors: settings,
                audioTimeline: await serializeAudioTimelineForFile()
            };

            const jsonStr = JSON.stringify(projectData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            const defaultName = currentAudioFileName 
                ? currentAudioFileName.replace(/\.[^/.]+$/, "") + ".jjd"
                : "mastering_project.jjd";
            a.href = url;
            a.download = defaultName;
            a.click();
            URL.revokeObjectURL(url);
        } catch(err) {
            console.error(err);
            alert("파일 내보내기에 실패했습니다: " + err.message);
        }
    };
}

const fileImportInput = document.getElementById('project-import-jjd');
if (fileImportInput) {
    fileImportInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = JSON.parse(evt.target.result);
                if (!["9.0", "10.0"].includes(data.version)) {
                    console.warn("JJD file version mismatch. File version: " + data.version);
                }

                if (data.activeStemIds) {
                    activeStemIds = data.activeStemIds.filter(id => stemRegistry.some(r => r.id === id));
                }

                if (data.audioState) {
                    Object.assign(audioState, data.audioState);
                }

                if (data.effectors) {
                    for (const [key, effector] of Object.entries(effectorRegistry)) {
                        if (data.effectors[key] && typeof effector.setSettings === 'function') {
                            effector.setSettings(data.effectors[key]);
                        }
                    }
                }

                const hydratedTimeline = data.version === "10.0" ? hydrateAudioTimelineFromFile(data.audioTimeline) : null;
                if (hydratedTimeline?.clips?.some((clip) => clip.fileBlob)) {
                    restoreAudioTimelineProject(hydratedTimeline).then((restored) => {
                        if (!restored) applyAllLoadedSettings();
                    });
                    alert("오디오 포함 프로젝트 파일(.jjd)을 불러오는 중입니다.");
                    return;
                }

                // Sync everything!
                applyAllLoadedSettings();
                alert("설정 파일(.jjd)을 성공적으로 불러왔습니다.");
            } catch(err) {
                console.error(err);
                alert("JJD 파일 읽기에 실패했습니다: " + err.message);
            }
        };
        reader.readAsText(file);
        // Clear input to allow importing the same file again
        fileImportInput.value = "";
    };
}

// Initial update of project dropdown
updateProjectDropdown();

// ==========================================
// Project Manager Collapse & Auto-Save Actions
// ==========================================

const projectHeader = document.getElementById('project-header');
const projectCollapseContent = document.getElementById('project-collapse-content');
const projectCollapseIcon = document.getElementById('project-collapse-icon');
if (projectHeader && projectCollapseContent && projectCollapseIcon) {
    projectHeader.onclick = () => {
        const isCollapsed = projectCollapseContent.classList.contains('hidden');
        if (isCollapsed) {
            projectCollapseContent.classList.remove('hidden');
            projectCollapseIcon.className = "fa-solid fa-chevron-up";
        } else {
            projectCollapseContent.classList.add('hidden');
            projectCollapseIcon.className = "fa-solid fa-chevron-down";
        }
        setTimeout(() => {
            handleResize();
        }, 100);
    };
}

let autosaveIntervalId = null;
let isAutosaveEnabled = false;

async function triggerAutosave() {
    try {
        const defaultName = currentAudioFileName 
            ? currentAudioFileName.replace(/\.[^/.]+$/, "") + "_AutoSave" 
            : "AutoSave";
        const settings = serializeEffectorSettings();
        
        // Overwrites the existing AutoSave project entry
        await saveProject(defaultName, currentAudioFileBlob, currentAudioFileName, activeStemIds, audioState, settings, serializeAudioTimelineProject());
        await updateProjectDropdown();

        // Animate the autosave icon for feedback
        const icon = document.getElementById('autosave-icon');
        if (icon) {
            icon.classList.remove('text-gray-500');
            icon.classList.add('text-green-500', 'animate-pulse');
            setTimeout(() => {
                icon.classList.remove('text-green-500', 'animate-pulse');
                icon.classList.add('text-gray-500');
            }, 1500);
        }
    } catch(err) {
        console.error("AutoSave failed", err);
    }
}

function startAutosave() {
    stopAutosave();
    const intervalInput = document.getElementById('autosave-interval');
    let minutes = 5;
    if (intervalInput) {
        minutes = Math.max(1, parseFloat(intervalInput.value) || 5);
    }
    const ms = minutes * 60 * 1000;
    autosaveIntervalId = setInterval(triggerAutosave, ms);
}

function stopAutosave() {
    if (autosaveIntervalId) {
        clearInterval(autosaveIntervalId);
        autosaveIntervalId = null;
    }
}

const autosaveToggleBtn = document.getElementById('autosave-toggle');
const autosaveIntervalInput = document.getElementById('autosave-interval');

if (autosaveToggleBtn) {
    autosaveToggleBtn.onclick = () => {
        isAutosaveEnabled = !isAutosaveEnabled;
        autosaveToggleBtn.setAttribute('aria-pressed', String(isAutosaveEnabled));
        autosaveToggleBtn.innerText = isAutosaveEnabled ? 'ON' : 'OFF';
        
        if (isAutosaveEnabled) {
            autosaveToggleBtn.className = "bg-green-600 border-green-500 text-white shadow-md shadow-green-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md border transition";
            startAutosave();
        } else {
            autosaveToggleBtn.className = "bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-gray-700 transition";
            stopAutosave();
        }
    };
}

if (autosaveIntervalInput) {
    autosaveIntervalInput.onchange = () => {
        if (isAutosaveEnabled) {
            startAutosave();
        }
    };
}
