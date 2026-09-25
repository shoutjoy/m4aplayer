class SpreadEffector {
    constructor(audioState) {
        this.audioState = audioState;
        this.defaultSettings = {
            enabled: false,
            spread: 45,
            centerDb: 0,
            sideDb: -9,
            lowCutHz: 160
        };
        this.presets = {
            default: { label: "Default", settings: this.defaultSettings },
            subtle: { label: "Subtle Master", settings: { enabled: true, spread: 28, centerDb: 0.5, sideDb: -13, lowCutHz: 180 } },
            open: { label: "Open Width", settings: { enabled: true, spread: 45, centerDb: 0, sideDb: -9, lowCutHz: 160 } },
            wide: { label: "Wide Air", settings: { enabled: true, spread: 62, centerDb: -0.8, sideDb: -10, lowCutHz: 190 } },
            monoSafe: { label: "Mono Safe", settings: { enabled: true, spread: 18, centerDb: 1.2, sideDb: -16, lowCutHz: 220 } }
        };
        this.nodes = null;
        this.bound = false;
        this.updateRangeFillCallback = null;
        this.ensureState();
    }

    ensureState() {
        this.audioState.spread = this.normalizeSettings(this.audioState.spread);
    }

    clamp(value, min, max, fallback) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(min, Math.min(max, numeric));
    }

    normalizeSettings(settings = {}) {
        const src = { ...this.defaultSettings, ...(settings || {}) };
        return {
            enabled: Boolean(src.enabled),
            spread: this.clamp(src.spread, 0, 100, this.defaultSettings.spread),
            centerDb: this.clamp(src.centerDb, -12, 6, this.defaultSettings.centerDb),
            sideDb: this.clamp(src.sideDb, -24, 0, this.defaultSettings.sideDb),
            lowCutHz: this.clamp(src.lowCutHz, 60, 400, this.defaultSettings.lowCutHz)
        };
    }

    dbToGain(db) {
        return Math.pow(10, Number(db || 0) / 20);
    }

    getSettings() {
        this.ensureState();
        return { ...this.audioState.spread };
    }

    setSettings(settings) {
        this.audioState.spread = this.normalizeSettings(settings);
        this.syncInputs();
        this.updateUI(this.updateRangeFillCallback);
    }

    reset() {
        this.setSettings(this.defaultSettings);
    }

    connect(context, inputNode, getBypassStateCallback) {
        this.ensureState();
        const input = context.createGain();
        const centerGain = context.createGain();
        const leftHighPass = context.createBiquadFilter();
        const rightHighPass = context.createBiquadFilter();
        const leftDelay = context.createDelay(0.05);
        const rightDelay = context.createDelay(0.05);
        const leftGain = context.createGain();
        const rightGain = context.createGain();
        const leftPanner = context.createStereoPanner ? context.createStereoPanner() : null;
        const rightPanner = context.createStereoPanner ? context.createStereoPanner() : null;
        const effectGain = context.createGain();
        const bypassGain = context.createGain();
        const output = context.createGain();

        leftHighPass.type = "highpass";
        rightHighPass.type = "highpass";

        inputNode.connect(input);
        input.connect(centerGain);
        centerGain.connect(effectGain);

        input.connect(leftHighPass);
        leftHighPass.connect(leftDelay);
        leftDelay.connect(leftGain);
        if (leftPanner) {
            leftGain.connect(leftPanner);
            leftPanner.connect(effectGain);
        } else {
            leftGain.connect(effectGain);
        }

        input.connect(rightHighPass);
        rightHighPass.connect(rightDelay);
        rightDelay.connect(rightGain);
        if (rightPanner) {
            rightGain.connect(rightPanner);
            rightPanner.connect(effectGain);
        } else {
            rightGain.connect(effectGain);
        }

        input.connect(bypassGain);
        effectGain.connect(output);
        bypassGain.connect(output);

        this.nodes = {
            input,
            centerGain,
            leftHighPass,
            rightHighPass,
            leftDelay,
            rightDelay,
            leftGain,
            rightGain,
            leftPanner,
            rightPanner,
            effectGain,
            bypassGain,
            output
        };
        this.applySettings(context, getBypassStateCallback);
        return output;
    }

    applySettings(context, getBypassStateCallback) {
        if (!this.nodes) return;
        this.ensureState();
        const s = this.audioState.spread;
        const activeContext = context || this.nodes.output?.context;
        const bypassed = typeof getBypassStateCallback === "function" ? getBypassStateCallback() : Boolean(getBypassStateCallback);
        const active = s.enabled && !bypassed;
        const now = activeContext?.currentTime || 0;
        const spreadNorm = active ? s.spread / 100 : 0;
        const sideGain = active ? this.dbToGain(s.sideDb) : 0;
        const centerGain = active ? this.dbToGain(s.centerDb) : 1;
        const leftDelayTime = spreadNorm * 0.014;
        const rightDelayTime = spreadNorm * 0.021;

        this.nodes.centerGain.gain.setTargetAtTime(centerGain, now, 0.015);
        this.nodes.leftGain.gain.setTargetAtTime(sideGain, now, 0.015);
        this.nodes.rightGain.gain.setTargetAtTime(sideGain, now, 0.015);
        this.nodes.leftDelay.delayTime.setTargetAtTime(leftDelayTime, now, 0.015);
        this.nodes.rightDelay.delayTime.setTargetAtTime(rightDelayTime, now, 0.015);
        this.nodes.leftHighPass.frequency.setTargetAtTime(s.lowCutHz, now, 0.015);
        this.nodes.rightHighPass.frequency.setTargetAtTime(s.lowCutHz, now, 0.015);
        this.nodes.leftPanner?.pan.setTargetAtTime(-spreadNorm, now, 0.015);
        this.nodes.rightPanner?.pan.setTargetAtTime(spreadNorm, now, 0.015);
        this.nodes.effectGain.gain.setTargetAtTime(active ? 1 : 0, now, 0.01);
        this.nodes.bypassGain.gain.setTargetAtTime(active ? 0 : 1, now, 0.01);
    }

    syncInputs() {
        this.ensureState();
        const s = this.audioState.spread;
        const map = {
            "spread-width": s.spread,
            "spread-center": s.centerDb,
            "spread-side": s.sideDb,
            "spread-lowcut": s.lowCutHz
        };
        Object.entries(map).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = String(value);
        });
    }

    updateUI(updateRangeFillCallback) {
        this.updateRangeFillCallback = updateRangeFillCallback || this.updateRangeFillCallback;
        this.ensureState();
        const s = this.audioState.spread;
        const panel = document.getElementById("master-spread-panel");
        const toggle = document.getElementById("spread-toggle");
        panel?.classList.toggle("is-enabled", s.enabled);
        if (toggle) {
            toggle.textContent = s.enabled ? "IN" : "OUT";
            toggle.classList.toggle("is-active", s.enabled);
            toggle.setAttribute("aria-pressed", String(s.enabled));
        }

        const labels = {
            "spread-width-val": `${Math.round(s.spread)}%`,
            "spread-center-val": `${s.centerDb.toFixed(1)} dB`,
            "spread-side-val": `${s.sideDb.toFixed(1)} dB`,
            "spread-lowcut-val": `${Math.round(s.lowCutHz)} Hz`,
            "spread-main-value": `${Math.round(s.spread)}%`,
            "spread-correlation-val": this.getCorrelationLabel(s)
        };
        Object.entries(labels).forEach(([id, text]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = text;
        });

        const warning = document.getElementById("spread-warning");
        if (warning) {
            warning.textContent = this.getWarning(s.spread);
            warning.classList.toggle("is-visible", Boolean(warning.textContent));
        }

        const leftBeam = document.getElementById("spread-left-beam");
        const rightBeam = document.getElementById("spread-right-beam");
        const dot = document.getElementById("spread-center-dot");
        const bar = document.getElementById("spread-correlation-fill");
        const beamScale = 0.22 + s.spread / 78;
        const beamAngle = 70 - s.spread * 0.46;
        if (leftBeam) leftBeam.style.transform = `rotate(${beamAngle}deg) scaleX(${-beamScale})`;
        if (rightBeam) rightBeam.style.transform = `rotate(${-beamAngle}deg) scaleX(${beamScale})`;
        if (dot) {
            const centerScale = 0.72 + ((s.centerDb + 12) / 18) * 0.45;
            dot.style.transform = `translate(-50%, -50%) scale(${centerScale})`;
            dot.style.opacity = String(0.65 + ((s.centerDb + 12) / 18) * 0.35);
        }
        if (bar) bar.style.width = `${Math.max(8, Math.min(100, 100 - s.spread * 0.55))}%`;

        document.querySelectorAll(".spread-slider").forEach((input) => {
            this.updateRangeFillCallback?.(input, "#a855f7");
        });
    }

    getCorrelationLabel(settings) {
        const estimate = Math.max(-0.25, Math.min(1, 0.92 - (settings.spread / 100) * 0.88 + (settings.sideDb + 24) / 240));
        return estimate.toFixed(2);
    }

    getWarning(spreadValue) {
        if (spreadValue >= 75) return "위상 문제가 커질 수 있습니다. Mono Check를 권장합니다.";
        if (spreadValue >= 60) return "마스터링에서는 다소 넓은 설정입니다. 저역과 보컬 중심을 확인하세요.";
        return "";
    }

    bindLiveControls(context, getPlayStateCallback, getBypassStateCallback, updateRangeFillCallback) {
        if (this.bound) return;
        this.bound = true;
        this.updateRangeFillCallback = updateRangeFillCallback;
        const apply = () => {
            this.syncInputs();
            this.updateUI(updateRangeFillCallback);
            if (getPlayStateCallback?.()) this.applySettings(context || this.nodes?.output?.context, getBypassStateCallback);
        };
        const sliderMap = {
            "spread-width": "spread",
            "spread-center": "centerDb",
            "spread-side": "sideDb",
            "spread-lowcut": "lowCutHz"
        };
        this.initSteppers(sliderMap);
        Object.entries(sliderMap).forEach(([id, key]) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.oninput = () => {
                this.audioState.spread[key] = Number(input.value);
                apply();
            };
        });
        document.getElementById("spread-toggle")?.addEventListener("click", () => {
            this.audioState.spread.enabled = !this.audioState.spread.enabled;
            apply();
        });
        document.getElementById("spread-preset")?.addEventListener("change", (event) => {
            const preset = this.presets[event.target.value];
            if (!preset) return;
            this.audioState.spread = this.normalizeSettings(preset.settings);
            apply();
        });
        document.getElementById("spread-collapse-btn")?.addEventListener("click", () => {
            const content = document.getElementById("spread-collapse-content");
            const icon = document.getElementById("spread-collapse-icon");
            const collapsed = !content?.classList.contains("is-collapsed");
            content?.classList.toggle("is-collapsed", collapsed);
            document.getElementById("spread-collapse-btn")?.setAttribute("aria-expanded", String(!collapsed));
            if (icon) icon.className = `fa-solid fa-chevron-${collapsed ? "down" : "up"}`;
        });
    }

    initSteppers(sliderMap) {
        Object.keys(sliderMap).forEach((id) => {
            const input = document.getElementById(id);
            if (!input || input.dataset.stepperReady === "true") return;
            input.dataset.stepperReady = "true";
            const wrapper = document.createElement("div");
            wrapper.className = "spread-stepper";
            const minus = document.createElement("button");
            minus.type = "button";
            minus.className = "spread-step-btn";
            minus.textContent = "-";
            minus.setAttribute("aria-label", `${id} decrease`);
            const plus = document.createElement("button");
            plus.type = "button";
            plus.className = "spread-step-btn";
            plus.textContent = "+";
            plus.setAttribute("aria-label", `${id} increase`);
            input.parentNode.insertBefore(wrapper, input);
            wrapper.append(minus, input, plus);
            const nudge = (direction) => {
                const min = Number(input.min || 0);
                const max = Number(input.max || 100);
                const step = Number(input.step || 1) || 1;
                const current = Number(input.value || 0);
                const next = Math.max(min, Math.min(max, current + direction * step));
                input.value = String(step < 1 ? Number(next.toFixed(3)) : Math.round(next));
                input.dispatchEvent(new Event("input", { bubbles: true }));
            };
            minus.addEventListener("click", () => nudge(-1));
            plus.addEventListener("click", () => nudge(1));
        });
    }

    populatePresets(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = Object.entries(this.presets)
            .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
            .join("");
        select.value = "default";
    }
}
