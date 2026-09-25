class SaturationEffector {
    constructor(audioState) {
        this.audioState = audioState;
        this.defaultSettings = {
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
        this.presets = {
            default: { label: "Default", settings: this.defaultSettings },
            warmTube: { label: "Warm Tube", settings: { enabled: true, drive: 1.6, mix: 42, output: -0.3, tone: -8, bias: 4, character: 55, evenOdd: 26, dynamics: -8, oversampling: 4, mode: "tube" } },
            tapeGlue: { label: "Tape Glue", settings: { enabled: true, drive: 1.2, mix: 36, output: -0.4, tone: -14, bias: 0, character: 68, evenOdd: 18, dynamics: -12, oversampling: 4, mode: "tape" } },
            transformer: { label: "Transformer", settings: { enabled: true, drive: 1.4, mix: 32, output: -0.2, tone: 4, bias: 7, character: 75, evenOdd: 22, dynamics: -6, oversampling: 2, mode: "transformer" } },
            cleanClip: { label: "Clean Soft Clip", settings: { enabled: true, drive: 0.8, mix: 28, output: -0.6, tone: 0, bias: 0, character: 20, evenOdd: 8, dynamics: -4, oversampling: 4, mode: "clean" } },
            airPolish: { label: "Air Polish", settings: { enabled: true, drive: 0.9, mix: 24, output: -0.2, tone: 18, bias: 0, character: 32, evenOdd: 15, dynamics: -5, oversampling: 4, mode: "tube" } }
        };
        this.nodes = null;
        this.visualFrame = 0;
        this.visualTimer = 0;
        this.bound = false;
        this.bandInteractionBound = false;
        this.bandDrag = null;
        this.updateRangeFillCallback = null;
        this.getPlayStateCallback = () => false;
        this.ensureState();
    }

    ensureState() {
        this.audioState.masterSaturation = this.normalizeSettings(this.audioState.masterSaturation);
    }

    normalizeSettings(settings = {}) {
        const src = { ...this.defaultSettings, ...(settings || {}) };
        return {
            enabled: Boolean(src.enabled),
            drive: this.clamp(src.drive, 0, 48, this.defaultSettings.drive),
            mix: this.clamp(src.mix, 0, 100, this.defaultSettings.mix),
            output: this.clamp(src.output, -12, 12, this.defaultSettings.output),
            tone: this.clamp(src.tone, -100, 100, this.defaultSettings.tone),
            bias: this.clamp(src.bias, -100, 100, this.defaultSettings.bias),
            character: this.clamp(src.character, 0, 100, this.defaultSettings.character),
            evenOdd: this.clamp(src.evenOdd, 0, 100, this.defaultSettings.evenOdd),
            dynamics: this.clamp(src.dynamics, -100, 100, this.defaultSettings.dynamics),
            oversampling: [1, 2, 4].includes(Number(src.oversampling)) ? Number(src.oversampling) : this.defaultSettings.oversampling,
            mode: ["tube", "tape", "transformer", "clean"].includes(src.mode) ? src.mode : this.defaultSettings.mode,
            bandLow: this.clamp(src.bandLow, 20, 19000, this.defaultSettings.bandLow),
            bandHigh: this.clamp(src.bandHigh, 40, 20000, this.defaultSettings.bandHigh)
        };
    }

    clamp(value, min, max, fallback) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(min, Math.min(max, numeric));
    }

    normalizeBandRange(settings = this.audioState.masterSaturation) {
        const low = this.clamp(settings.bandLow, 20, 19000, this.defaultSettings.bandLow);
        const high = this.clamp(settings.bandHigh, 40, 20000, this.defaultSettings.bandHigh);
        const orderedLow = Math.min(low, high - 20);
        const orderedHigh = Math.max(high, orderedLow + 20);
        settings.bandLow = Math.max(20, Math.min(19000, orderedLow));
        settings.bandHigh = Math.max(settings.bandLow + 20, Math.min(20000, orderedHigh));
        return settings;
    }

    freqToX(freq, width) {
        return Math.log10(Math.max(20, Math.min(20000, freq)) / 20) / Math.log10(20000 / 20) * width;
    }

    xToFreq(x, width) {
        const pct = Math.max(0, Math.min(1, x / Math.max(1, width)));
        return 20 * Math.pow(20000 / 20, pct);
    }

    formatFreq(freq) {
        return freq >= 1000 ? `${(freq / 1000).toFixed(freq >= 10000 ? 1 : 2)} kHz` : `${Math.round(freq)} Hz`;
    }

    getSettings() {
        this.ensureState();
        return { ...this.audioState.masterSaturation };
    }

    loadSettings(settings) {
        this.audioState.masterSaturation = this.normalizeSettings(settings);
        this.syncInputs();
        this.updateUI(this.updateRangeFillCallback);
        this.updateVisualizers();
    }

    reset() {
        this.loadSettings(this.defaultSettings);
    }

    connect(context, inputNode, getBypassStateCallback, { startVisualizer = true } = {}) {
        this.ensureState();
        const input = context.createGain();
        const dry = context.createGain();
        const wetInput = context.createGain();
        const preTone = context.createBiquadFilter();
        const shaper = context.createWaveShaper();
        const postTone = context.createBiquadFilter();
        const wet = context.createGain();
        const output = context.createGain();
        const analyser = context.createAnalyser();

        preTone.type = "lowshelf";
        preTone.frequency.value = 180;
        postTone.type = "highshelf";
        postTone.frequency.value = 5200;
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;

        inputNode.connect(input);
        input.connect(analyser);
        input.connect(dry);
        input.connect(wetInput);
        wetInput.connect(preTone);
        preTone.connect(shaper);
        shaper.connect(postTone);
        postTone.connect(wet);
        dry.connect(output);
        wet.connect(output);

        this.nodes = { input, dry, wetInput, preTone, shaper, postTone, wet, output, analyser };
        this.applySettings(context, getBypassStateCallback);
        if (startVisualizer) this.startVisualizerLoop();
        return output;
    }

    applySettings(context, getBypassStateCallback) {
        if (!this.nodes) return;
        this.ensureState();
        const activeContext = context || this.nodes.output?.context;
        const s = this.audioState.masterSaturation;
        const bypassed = typeof getBypassStateCallback === "function" ? getBypassStateCallback() : Boolean(getBypassStateCallback);
        const active = s.enabled && !bypassed;
        const now = activeContext?.currentTime || 0;
        const mix = active ? s.mix / 100 : 0;
        const outputGain = this.dbToGain(active ? s.output : 0);
        const driveGain = this.dbToGain(active ? s.drive : 0);
        const tone = active ? s.tone : 0;

        this.nodes.dry.gain.setValueAtTime(1 - mix * 0.82, now);
        this.nodes.wetInput.gain.setValueAtTime(driveGain, now);
        this.nodes.wet.gain.setValueAtTime(mix, now);
        this.nodes.output.gain.setValueAtTime(outputGain, now);
        this.nodes.preTone.gain.setValueAtTime(active ? Math.max(-4, -tone * 0.035) : 0, now);
        this.nodes.postTone.gain.setValueAtTime(active ? tone * 0.045 : 0, now);
        this.nodes.shaper.curve = this.makeCurve(active ? s : { ...s, drive: 0, character: 0, evenOdd: 0, bias: 0 });
        this.nodes.shaper.oversample = s.oversampling === 4 ? "4x" : (s.oversampling === 2 ? "2x" : "none");
    }

    dbToGain(db) {
        return Math.pow(10, Number(db || 0) / 20);
    }

    makeCurve(settings) {
        const n = 4096;
        const curve = new Float32Array(n);
        const drive = 1 + (Number(settings.drive) || 0) / 7;
        const character = (Number(settings.character) || 0) / 100;
        const even = (Number(settings.evenOdd) || 0) / 100;
        const bias = (Number(settings.bias) || 0) / 250;
        const modeShape = { tube: 1.15, tape: 0.92, transformer: 1.35, clean: 0.72 }[settings.mode] || 1;
        for (let i = 0; i < n; i += 1) {
            const x = (i / (n - 1)) * 2 - 1;
            const driven = (x + bias) * drive * modeShape;
            const soft = Math.tanh(driven);
            const asymmetric = Math.tanh(driven + even * 0.22) - Math.tanh(even * 0.22);
            const folded = soft * (1 - character * 0.18) + Math.sin(soft * Math.PI * 0.5) * character * 0.18;
            curve[i] = folded * (1 - even * 0.34) + asymmetric * even * 0.34;
        }
        return curve;
    }

    syncInputs() {
        this.ensureState();
        const s = this.audioState.masterSaturation;
        const map = {
            "saturation-drive": s.drive,
            "saturation-mix": s.mix,
            "saturation-output": s.output,
            "saturation-tone": s.tone,
            "saturation-bias": s.bias,
            "saturation-character": s.character,
            "saturation-evenodd": s.evenOdd,
            "saturation-dynamics": s.dynamics,
            "saturation-oversampling": s.oversampling
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = String(value);
        });
        document.querySelectorAll("[data-saturation-mode]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.saturationMode === s.mode);
        });
    }

    updateUI(updateRangeFillCallback) {
        this.updateRangeFillCallback = updateRangeFillCallback || this.updateRangeFillCallback;
        this.ensureState();
        const s = this.audioState.masterSaturation;
        const panel = document.getElementById("master-saturation-panel");
        const toggle = document.getElementById("saturation-toggle");
        panel?.classList.toggle("is-enabled", s.enabled);
        if (toggle) {
            toggle.textContent = s.enabled ? "IN" : "OUT";
            toggle.classList.toggle("is-active", s.enabled);
            toggle.setAttribute("aria-pressed", String(s.enabled));
        }
        const labels = {
            "saturation-drive-val": `${s.drive.toFixed(1)} dB`,
            "saturation-mix-val": `${Math.round(s.mix)} %`,
            "saturation-output-val": `${s.output.toFixed(1)} dB`,
            "saturation-tone-val": s.tone === 0 ? "Neutral" : `${s.tone > 0 ? "Bright +" : "Dark "}${Math.round(s.tone)}`,
            "saturation-bias-val": s.bias.toFixed(0),
            "saturation-character-val": `${Math.round(s.character)} %`,
            "saturation-evenodd-val": `${Math.round(s.evenOdd)}% EVEN`,
            "saturation-dynamics-val": `${Math.round(s.dynamics)} %`,
            "saturation-oversampling-val": `${s.oversampling}x`
        };
        Object.entries(labels).forEach(([id, text]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        });
        document.querySelectorAll(".saturation-slider").forEach((input) => {
            this.updateRangeFillCallback?.(input, "#f59e0b");
        });
        document.querySelectorAll("[data-saturation-mode]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.saturationMode === s.mode);
        });
        this.updateVisualizers();
    }

    populatePresets(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = Object.entries(this.presets)
            .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
            .join("");
        select.value = "default";
    }

    bindLiveControls(context, getPlayStateCallback, getBypassStateCallback, updateRangeFillCallback) {
        if (this.bound) return;
        this.bound = true;
        this.getPlayStateCallback = typeof getPlayStateCallback === "function" ? getPlayStateCallback : () => false;
        this.updateRangeFillCallback = updateRangeFillCallback;
        const apply = () => {
            this.syncInputs();
            this.updateUI(updateRangeFillCallback);
            if (getPlayStateCallback?.()) this.applySettings(context || this.nodes?.output?.context, getBypassStateCallback);
        };
        const sliderMap = {
            "saturation-drive": "drive",
            "saturation-mix": "mix",
            "saturation-output": "output",
            "saturation-tone": "tone",
            "saturation-bias": "bias",
            "saturation-character": "character",
            "saturation-evenodd": "evenOdd",
            "saturation-dynamics": "dynamics",
            "saturation-oversampling": "oversampling"
        };
        this.initTouchSteppers(sliderMap);
        Object.entries(sliderMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.oninput = () => {
                this.audioState.masterSaturation[key] = key === "oversampling" ? Number(el.value) : Number(el.value);
                apply();
            };
        });
        document.getElementById("saturation-toggle")?.addEventListener("click", () => {
            this.audioState.masterSaturation.enabled = !this.audioState.masterSaturation.enabled;
            apply();
        });
        document.querySelectorAll("[data-saturation-mode]").forEach((button) => {
            button.addEventListener("click", () => {
                this.audioState.masterSaturation.mode = button.dataset.saturationMode;
                apply();
            });
        });
        document.getElementById("saturation-preset")?.addEventListener("change", (event) => {
            const preset = this.presets[event.target.value];
            if (!preset) return;
            this.audioState.masterSaturation = this.normalizeSettings(preset.settings);
            apply();
        });
        const collapse = document.getElementById("saturation-collapse-btn");
        collapse?.addEventListener("click", () => {
            const content = document.getElementById("saturation-collapse-content");
            const icon = document.getElementById("saturation-collapse-icon");
            const collapsed = !content?.classList.contains("is-collapsed");
            content?.classList.toggle("is-collapsed", collapsed);
            collapse.setAttribute("aria-expanded", String(!collapsed));
            if (icon) icon.className = `fa-solid fa-chevron-${collapsed ? "down" : "up"}`;
            if (!collapsed) window.setTimeout(() => this.updateVisualizers(), 0);
        });
    }

    initTouchSteppers(sliderMap) {
        Object.keys(sliderMap).forEach((id) => {
            const input = document.getElementById(id);
            if (!input || input.type !== "range" || input.dataset.stepperReady === "true") return;
            input.dataset.stepperReady = "true";

            const wrapper = document.createElement("div");
            wrapper.className = "saturation-stepper";

            const minus = document.createElement("button");
            minus.type = "button";
            minus.className = "saturation-step-btn";
            minus.dataset.stepDir = "-1";
            minus.setAttribute("aria-label", `${id} decrease`);
            minus.textContent = "−";

            const plus = document.createElement("button");
            plus.type = "button";
            plus.className = "saturation-step-btn";
            plus.dataset.stepDir = "1";
            plus.setAttribute("aria-label", `${id} increase`);
            plus.textContent = "+";

            input.parentNode.insertBefore(wrapper, input);
            wrapper.append(minus, input, plus);

            const nudge = (direction) => {
                const min = Number(input.min || 0);
                const max = Number(input.max || 100);
                const step = Number(input.step || 1) || 1;
                const current = Number(input.value || 0);
                const next = Math.max(min, Math.min(max, current + direction * step));
                const fixed = step < 1 ? Number(next.toFixed(3)) : Math.round(next);
                input.value = String(fixed);
                input.dispatchEvent(new Event("input", { bubbles: true }));
            };

            [minus, plus].forEach((button) => {
                let repeatTimer = 0;
                let repeatDelayTimer = 0;
                const direction = Number(button.dataset.stepDir);
                const clearRepeat = () => {
                    window.clearTimeout(repeatDelayTimer);
                    window.clearInterval(repeatTimer);
                    repeatDelayTimer = 0;
                    repeatTimer = 0;
                };
                button.addEventListener("click", (event) => {
                    event.preventDefault();
                    nudge(direction);
                });
                button.addEventListener("pointerdown", (event) => {
                    event.preventDefault();
                    button.setPointerCapture?.(event.pointerId);
                    repeatDelayTimer = window.setTimeout(() => {
                        repeatTimer = window.setInterval(() => nudge(direction), 80);
                    }, 360);
                });
                button.addEventListener("pointerup", clearRepeat);
                button.addEventListener("pointercancel", clearRepeat);
                button.addEventListener("pointerleave", clearRepeat);
            });
        });
    }

    startVisualizerLoop() {
        if (this.visualTimer) return;
        let lastFrameAt = 0;
        const tick = (now = 0) => {
            if (!document.hidden && now - lastFrameAt >= 33 && this.getPlayStateCallback?.()) {
                lastFrameAt = now;
                this.visualFrame += 1;
                this.updateVisualizers();
            }
            this.visualTimer = window.requestAnimationFrame(tick);
        };
        this.visualTimer = window.requestAnimationFrame(tick);
    }

    initVisualizers() {
        this.initBandInteraction();
        this.updateVisualizers();
    }

    initBandInteraction() {
        if (this.bandInteractionBound) return;
        const canvas = document.getElementById("saturation-band-canvas");
        if (!canvas) return;
        this.bandInteractionBound = true;
        const getLocalX = (event) => {
            const rect = canvas.getBoundingClientRect();
            return Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        };
        const getBandPx = () => {
            this.ensureState();
            this.normalizeBandRange();
            const rect = canvas.getBoundingClientRect();
            const w = rect.width || canvas.width || 1;
            return {
                w,
                x1: this.freqToX(this.audioState.masterSaturation.bandLow, w),
                x2: this.freqToX(this.audioState.masterSaturation.bandHigh, w)
            };
        };
        const applyDrag = (event) => {
            if (!this.bandDrag) return;
            event.preventDefault();
            const { w } = getBandPx();
            const dx = getLocalX(event) - this.bandDrag.startX;
            const minWidth = Math.max(18, this.bandDrag.startX2 - this.bandDrag.startX1 < 18 ? 18 : 0);
            let nextX1 = this.bandDrag.startX1;
            let nextX2 = this.bandDrag.startX2;
            if (this.bandDrag.mode === "left") {
                nextX1 = Math.max(0, Math.min(this.bandDrag.startX2 - 18, this.bandDrag.startX1 + dx));
            } else if (this.bandDrag.mode === "right") {
                nextX2 = Math.min(w, Math.max(this.bandDrag.startX1 + 18, this.bandDrag.startX2 + dx));
            } else {
                const width = Math.max(minWidth, this.bandDrag.startX2 - this.bandDrag.startX1);
                nextX1 = Math.max(0, Math.min(w - width, this.bandDrag.startX1 + dx));
                nextX2 = nextX1 + width;
            }
            this.audioState.masterSaturation.bandLow = this.xToFreq(nextX1, w);
            this.audioState.masterSaturation.bandHigh = this.xToFreq(nextX2, w);
            this.normalizeBandRange();
            this.updateVisualizers();
        };
        const endDrag = (event) => {
            if (!this.bandDrag) return;
            this.bandDrag = null;
            canvas.classList.remove("is-dragging");
            if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        };
        canvas.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            const x = getLocalX(event);
            const { x1, x2 } = getBandPx();
            const edge = 14;
            const inside = x >= x1 && x <= x2;
            if (!inside && Math.abs(x - x1) > edge && Math.abs(x - x2) > edge) return;
            event.preventDefault();
            this.bandDrag = {
                mode: Math.abs(x - x1) <= edge ? "left" : (Math.abs(x - x2) <= edge ? "right" : "move"),
                startX: x,
                startX1: x1,
                startX2: x2
            };
            canvas.classList.add("is-dragging");
            canvas.setPointerCapture?.(event.pointerId);
        });
        canvas.addEventListener("pointermove", (event) => {
            if (this.bandDrag) {
                applyDrag(event);
                return;
            }
            const x = getLocalX(event);
            const { x1, x2 } = getBandPx();
            canvas.style.cursor = Math.abs(x - x1) <= 14 || Math.abs(x - x2) <= 14
                ? "ew-resize"
                : (x >= x1 && x <= x2 ? "grab" : "default");
        });
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
        canvas.addEventListener("dblclick", () => {
            this.audioState.masterSaturation.bandLow = this.defaultSettings.bandLow;
            this.audioState.masterSaturation.bandHigh = this.defaultSettings.bandHigh;
            this.updateVisualizers();
        });
    }

    updateVisualizers() {
        this.drawHarmonics();
        this.drawCurve();
        this.drawFrequencyResponse();
        this.drawBand();
        this.updateOutputMeter();
    }

    updateOutputMeter() {
        const fill = document.getElementById("saturation-output-meter-fill");
        const label = document.getElementById("saturation-output-meter-db");
        if (!fill && !label) return;
        this.ensureState();
        const s = this.audioState.masterSaturation;
        const isPlaying = Boolean(this.getPlayStateCallback?.());
        const analyser = this.nodes?.analyser;
        let db = -Infinity;
        if (isPlaying && analyser) {
            const data = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i += 1) {
                const sample = (data[i] - 128) / 128;
                sum += sample * sample;
            }
            const rms = Math.sqrt(sum / Math.max(1, data.length));
            db = 20 * Math.log10(Math.max(0.000001, rms)) + (s.enabled ? s.output : 0);
        }
        const displayDb = Number.isFinite(db) ? Math.max(-60, Math.min(6, db)) : -60;
        const pct = Math.max(0, Math.min(100, ((displayDb + 60) / 66) * 100));
        if (fill) fill.style.width = `${pct.toFixed(1)}%`;
        if (label) label.textContent = displayDb <= -59.5 ? "-inf dB" : `${displayDb.toFixed(1)} dB`;
    }

    setupCanvas(canvas) {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(240, Math.round((rect.width || canvas.width || 600) * dpr));
        const height = Math.max(120, Math.round((rect.height || canvas.height || 220) * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, w: width / dpr, h: height / dpr };
    }

    drawGrid(ctx, w, h, color = "rgba(96, 165, 250, 0.11)") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        for (let i = 1; i < 6; i += 1) {
            const x = (w / 6) * i;
            const y = (h / 6) * i;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
    }

    drawHarmonics() {
        const canvas = document.getElementById("saturation-harmonics-canvas");
        const setup = this.setupCanvas(canvas);
        if (!setup) return;
        const { ctx, w, h } = setup;
        const s = this.audioState.masterSaturation;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#030812";
        ctx.fillRect(0, 0, w, h);
        this.drawGrid(ctx, w, h);
        const analyser = this.nodes?.analyser;
        let data = null;
        if (analyser) {
            data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
        }
        const bars = 120;
        for (let i = 0; i < bars; i += 1) {
            const x = 14 + (i / bars) * (w - 28);
            const bin = data ? data[Math.min(data.length - 1, Math.floor((i / bars) * data.length * 0.75))] : 30 + 25 * Math.sin(i * 0.34 + this.visualFrame * 0.035);
            const harmonic = (i % 11 === 0 || i % 17 === 0) ? (s.drive * 3 + s.character * 0.25) : 0;
            const height = Math.max(3, (bin / 255) * (h * 0.72) + harmonic);
            const hue = i < 28 ? 198 : (i < 72 ? 96 : 273);
            ctx.fillStyle = `hsla(${hue}, 90%, 56%, ${0.28 + Math.min(0.5, height / h)})`;
            ctx.fillRect(x, h - 24 - height, Math.max(1.5, w / bars * 0.34), height);
        }
        const marks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        marks.forEach((m, index) => {
            const x = 95 + index * ((w - 170) / 9);
            const level = h * (0.22 + index * 0.055);
            ctx.strokeStyle = index % 2 ? "#a855f7" : "#84cc16";
            if (m === 1) ctx.strokeStyle = "#38bdf8";
            ctx.beginPath();
            ctx.moveTo(x, level);
            ctx.lineTo(x, h - 30);
            ctx.stroke();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = "700 11px ui-monospace, monospace";
            ctx.fillText(m === 1 ? "FUND" : `H${m}`, x - 10, level - 8);
        });
        const total = document.getElementById("saturation-harmonic-total");
        if (total) total.textContent = `${(-32 + s.drive * 1.4 + s.mix * 0.05).toFixed(1)} dB`;
    }

    drawCurve() {
        const canvas = document.getElementById("saturation-curve-canvas");
        const setup = this.setupCanvas(canvas);
        if (!setup) return;
        const { ctx, w, h } = setup;
        const s = this.audioState.masterSaturation;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#030812";
        ctx.fillRect(0, 0, w, h);
        this.drawGrid(ctx, w, h, "rgba(148,163,184,0.16)");
        ctx.strokeStyle = "rgba(148,163,184,0.45)";
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
        const curve = this.makeCurve(s);
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < curve.length; i += 24) {
            const x = (i / (curve.length - 1)) * w;
            const y = h / 2 - curve[i] * h * 0.42;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < curve.length; i += 24) {
            const x = (i / (curve.length - 1)) * w;
            const input = (i / (curve.length - 1)) * 2 - 1;
            const y = h / 2 - (input * (1 - s.mix / 220) + curve[i] * (s.mix / 220)) * h * 0.42;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        const gr = document.getElementById("saturation-clip-gr");
        if (gr) gr.textContent = `${(-Math.max(0, s.drive - 1) * 0.34).toFixed(1)} dB GR`;
    }

    drawFrequencyResponse() {
        const canvas = document.getElementById("saturation-response-canvas");
        const setup = this.setupCanvas(canvas);
        if (!setup) return;
        const { ctx, w, h } = setup;
        const s = this.audioState.masterSaturation;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#030812";
        ctx.fillRect(0, 0, w, h);
        this.drawGrid(ctx, w, h);
        const points = [];
        for (let i = 0; i <= 96; i += 1) {
            const t = i / 96;
            const low = -s.tone * 0.018 * (1 - t);
            const mid = Math.sin(t * Math.PI) * (s.character / 100) * 3.2;
            const high = s.tone * 0.035 * t + Math.sin(t * Math.PI * 2.2) * 0.6;
            const db = low + mid + high;
            points.push({ x: t * w, y: h / 2 - db * (h / 26) });
        }
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(34,211,238,0.45)");
        grad.addColorStop(1, "rgba(34,211,238,0.02)");
        ctx.beginPath();
        points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.beginPath();
        points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
        const mid = document.getElementById("saturation-response-mid");
        if (mid) mid.textContent = `${((s.character / 100) * 2.4).toFixed(1)} dB`;
    }

    drawBand() {
        const canvas = document.getElementById("saturation-band-canvas");
        const setup = this.setupCanvas(canvas);
        if (!setup) return;
        const { ctx, w, h } = setup;
        const s = this.audioState.masterSaturation;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#030812";
        ctx.fillRect(0, 0, w, h);
        this.drawGrid(ctx, w, h, "rgba(96,165,250,0.08)");
        const zones = [
            ["LOWS", 0, 0.2, "#38bdf8"],
            ["LOW-MIDS", 0.2, 0.42, "#22d3ee"],
            ["MIDS", 0.42, 0.62, "#84cc16"],
            ["HIGH-MIDS", 0.62, 0.82, "#f59e0b"],
            ["HIGHS", 0.82, 1, "#a78bfa"]
        ];
        zones.forEach(([label, a, b, color]) => {
            ctx.fillStyle = `${color}16`;
            ctx.fillRect(a * w, 0, (b - a) * w, h);
            ctx.fillStyle = color;
            ctx.font = "800 12px ui-monospace, monospace";
            ctx.fillText(label, a * w + 10, 18);
        });
        for (let i = 0; i < 140; i += 1) {
            const x = 18 + (i / 140) * (w - 36);
            const amp = 0.2 + 0.5 * Math.abs(Math.sin(i * 0.17 + this.visualFrame * 0.016)) * (0.25 + s.mix / 130);
            ctx.fillStyle = `rgba(34,211,238,${0.14 + amp * 0.28})`;
            ctx.fillRect(x, h - 30 - amp * (h - 56), Math.max(1, w / 180), amp * (h - 56));
        }
        this.normalizeBandRange(s);
        const lo = s.bandLow;
        const hi = s.bandHigh;
        const x1 = this.freqToX(lo, w);
        const x2 = this.freqToX(hi, w);
        ctx.fillStyle = "rgba(245,158,11,0.22)";
        ctx.fillRect(x1, 24, x2 - x1, h - 54);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, 24, x2 - x1, h - 54);
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(x1 - 3, 24, 6, h - 54);
        ctx.fillRect(x2 - 3, 24, 6, h - 54);
        ctx.fillStyle = "rgba(3, 7, 13, 0.78)";
        ctx.fillRect(Math.max(6, x1 + 8), h - 28, Math.min(210, x2 - x1 - 16), 18);
        ctx.fillStyle = "#fde68a";
        ctx.font = "800 10px ui-monospace, monospace";
        ctx.fillText("drag / edge resize", Math.max(12, x1 + 14), h - 15);
        const info = document.getElementById("saturation-band-info");
        if (info) info.textContent = `${this.formatFreq(lo)} - ${this.formatFreq(hi)}`;
    }
}
