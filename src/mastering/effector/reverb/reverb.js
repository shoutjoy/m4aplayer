class ReverbEffector {
    constructor(audioState) {
        this.audioState = audioState;
        this.presets = {
            default_reverb: { name: "Default Reverb", preDelay: 105, decay: 1.8, diffusion: 58, lowGain: -1, highGain: 1.5, mix: 22 },
            small_room: { name: "Small Room", preDelay: 20, decay: 1.2, diffusion: 70, lowGain: -2, highGain: 1, mix: 15 },
            vocal_hall: { name: "Vocal Hall", preDelay: 40, decay: 2.8, diffusion: 90, lowGain: -1, highGain: 2, mix: 30 },
            vocal_plate: { name: "Vocal Plate", preDelay: 10, decay: 2.2, diffusion: 95, lowGain: -3, highGain: 3, mix: 25 },
            cathedral: { name: "Cathedral", preDelay: 90, decay: 8.0, diffusion: 100, lowGain: 1, highGain: 0, mix: 50 },
            arena: { name: "Arena", preDelay: 70, decay: 5.0, diffusion: 90, lowGain: 0, highGain: 1, mix: 45 },
            drum_room: { name: "Drum Room", preDelay: 5, decay: 0.8, diffusion: 60, lowGain: 0, highGain: -1, mix: 10 },
            snare_plate: { name: "Snare Plate", preDelay: 15, decay: 1.5, diffusion: 90, lowGain: -2, highGain: 4, mix: 20 },
            guitar_room: { name: "Guitar Room", preDelay: 15, decay: 1.0, diffusion: 80, lowGain: -1, highGain: 2, mix: 15 },
            piano_hall: { name: "Piano Hall", preDelay: 30, decay: 3.5, diffusion: 95, lowGain: 0, highGain: 1, mix: 30 },
            ambient_space: { name: "Ambient Space", preDelay: 120, decay: 12.0, diffusion: 100, lowGain: 0, highGain: 4, mix: 70 }
        };
        this.customPresetKey = 'jd-reverb-presets';
        this.nodes = {
            input: null,
            output: null,
            dry: null,
            wet: null,
            preDelay: null,
            convolver: null,
            lowShelf: null,
            highShelf: null
        };
        this.visual = null;
        this.visualBound = false;
        this.graphDrag = null;
        this.liveBinding = null;
        this.updateRangeFillCallback = null;
    }

    getCustomPresets() {
        try {
            const data = JSON.parse(localStorage.getItem(this.customPresetKey) || '[]');
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    setCustomPresets(presets) {
        try {
            localStorage.setItem(this.customPresetKey, JSON.stringify(presets));
        } catch (error) {}
    }

    cloneSettings(settings = this.audioState.reverb) {
        const fallback = { enabled: true, preDelay: 105, decay: 1.8, diffusion: 58, lowGain: -1, highGain: 1.5, mix: 22 };
        return {
            enabled: settings.enabled === undefined ? fallback.enabled : Boolean(settings.enabled),
            preDelay: Number.isFinite(Number(settings.preDelay)) ? Number(settings.preDelay) : fallback.preDelay,
            decay: Number.isFinite(Number(settings.decay)) ? Number(settings.decay) : fallback.decay,
            diffusion: Number.isFinite(Number(settings.diffusion)) ? Number(settings.diffusion) : fallback.diffusion,
            lowGain: Number.isFinite(Number(settings.lowGain)) ? Number(settings.lowGain) : fallback.lowGain,
            highGain: Number.isFinite(Number(settings.highGain)) ? Number(settings.highGain) : fallback.highGain,
            mix: Number.isFinite(Number(settings.mix)) ? Number(settings.mix) : fallback.mix
        };
    }

    createReverbImpulse(context, duration = 1.2, diffusion = 70) {
        const sampleRate = context.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * duration));
        const impulse = context.createBuffer(2, length, sampleRate);
        const diffusionAmount = Math.max(0, Math.min(1, diffusion / 100));
        const decayPower = 1.4 + (diffusionAmount * 2.4);

        for (let ch = 0; ch < 2; ch++) {
            const channel = impulse.getChannelData(ch);
            let smoothed = 0;
            for (let i = 0; i < length; i++) {
                const t = i / length;
                const noise = (Math.random() * 2) - 1;
                smoothed = (smoothed * diffusionAmount) + (noise * (1 - diffusionAmount));
                channel[i] = smoothed * Math.pow(1 - t, decayPower);
            }
        }
        return impulse;
    }

    populatePresets(selectId) {
        const reverbPreset = document.getElementById(selectId);
        if (!reverbPreset) return;
        const customPresets = this.getCustomPresets();
        reverbPreset.innerHTML = '<option value="">Reverb Preset</option>';
        Object.entries(this.presets).forEach(([key, preset]) => {
            const option = document.createElement('option');
            option.value = `default:${key}`;
            option.textContent = preset.name;
            reverbPreset.appendChild(option);
        });
        customPresets.forEach((preset, idx) => {
            const option = document.createElement('option');
            option.value = `custom:${idx}`;
            option.textContent = `Saved: ${preset.name}`;
            reverbPreset.appendChild(option);
        });
    }

    connect(context, inputNode, getBypassStateCallback) {
        this.nodes.input = context.createGain();
        this.nodes.output = context.createGain();
        this.nodes.dry = context.createGain();
        this.nodes.wet = context.createGain();
        this.nodes.preDelay = context.createDelay(1);
        this.nodes.convolver = context.createConvolver();
        this.nodes.lowShelf = context.createBiquadFilter();
        this.nodes.highShelf = context.createBiquadFilter();

        this.nodes.lowShelf.type = 'lowshelf';
        this.nodes.lowShelf.frequency.value = 250;
        this.nodes.highShelf.type = 'highshelf';
        this.nodes.highShelf.frequency.value = 4000;
        this.nodes.convolver.buffer = this.createReverbImpulse(context, this.audioState.reverb.decay, this.audioState.reverb.diffusion);

        inputNode.connect(this.nodes.input);
        this.nodes.input.connect(this.nodes.dry);
        this.nodes.input.connect(this.nodes.preDelay);
        this.nodes.preDelay.connect(this.nodes.convolver);
        this.nodes.convolver.connect(this.nodes.lowShelf);
        this.nodes.lowShelf.connect(this.nodes.highShelf);
        this.nodes.highShelf.connect(this.nodes.wet);
        this.nodes.dry.connect(this.nodes.output);
        this.nodes.wet.connect(this.nodes.output);

        this.applySettings(context, getBypassStateCallback, false);
        return this.nodes.output;
    }

    applySettings(context, getBypassStateCallback, rebuildImpulse = false) {
        if (!this.nodes.input) return;
        const rvb = this.audioState.reverb;
        const disabled = getBypassStateCallback() || !rvb.enabled;
        const now = context.currentTime;
        const mix = disabled ? 0 : Math.max(0, Math.min(1, rvb.mix / 100));

        this.nodes.dry.gain.setValueAtTime(1 - mix, now);
        this.nodes.wet.gain.setValueAtTime(mix, now);
        this.nodes.preDelay.delayTime.setValueAtTime((disabled ? 0 : rvb.preDelay) / 1000, now);
        this.nodes.lowShelf.gain.setValueAtTime(disabled ? 0 : rvb.lowGain, now);
        this.nodes.highShelf.gain.setValueAtTime(disabled ? 0 : rvb.highGain, now);

        if (rebuildImpulse && this.nodes.convolver) {
            this.nodes.convolver.buffer = this.createReverbImpulse(context, rvb.decay, rvb.diffusion);
        }
    }

    syncInputs() {
        const rvb = this.audioState.reverb;
        const preDelay = document.getElementById('reverb-predelay');
        const decay = document.getElementById('reverb-decay');
        const diffusion = document.getElementById('reverb-diffusion');
        const mix = document.getElementById('reverb-mix');
        const low = document.getElementById('reverb-low');
        const high = document.getElementById('reverb-high');

        if (preDelay) preDelay.value = rvb.preDelay;
        if (decay) decay.value = rvb.decay;
        if (diffusion) diffusion.value = rvb.diffusion;
        if (mix) mix.value = rvb.mix;
        if (low) low.value = rvb.lowGain;
        if (high) high.value = rvb.highGain;
    }

    formatCompactNumber(value) {
        return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }

    updateUI(updateRangeFillCallback) {
        const rvb = this.audioState.reverb;
        const reverbToggle = document.getElementById('reverb-toggle');
        if (reverbToggle) {
            reverbToggle.setAttribute('aria-pressed', String(rvb.enabled));
            reverbToggle.innerText = rvb.enabled ? 'IN' : 'OUT';
            reverbToggle.className = rvb.enabled
                ? "bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-violet-500 shadow-md shadow-violet-500/30 transition"
                : "bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-gray-700 transition";
        }
        const predelayVal = document.getElementById('reverb-predelay-val');
        const decayVal = document.getElementById('reverb-decay-val');
        const diffusionVal = document.getElementById('reverb-diffusion-val');
        const mixVal = document.getElementById('reverb-mix-val');
        const lowVal = document.getElementById('reverb-low-val');
        const highVal = document.getElementById('reverb-high-val');

        if (predelayVal) predelayVal.innerText = `${Math.round(rvb.preDelay)} ms`;
        if (decayVal) decayVal.innerText = `${this.formatCompactNumber(rvb.decay)} s`;
        if (diffusionVal) diffusionVal.innerText = `${Math.round(rvb.diffusion)} %`;
        if (mixVal) mixVal.innerText = `${Math.round(rvb.mix)} %`;
        if (lowVal) lowVal.innerText = `${this.formatCompactNumber(rvb.lowGain)} dB`;
        if (highVal) highVal.innerText = `${this.formatCompactNumber(rvb.highGain)} dB`;

        if (updateRangeFillCallback) {
            updateRangeFillCallback();
        }
        this.updateReverbVisualizers();
    }

    initVisualizers(updateRangeFillCallback) {
        this.updateRangeFillCallback = updateRangeFillCallback || this.updateRangeFillCallback;
        this.visual = {
            envelopeCanvas: document.getElementById('reverb-envelope-canvas'),
            eqCanvas: document.getElementById('reverb-eq-canvas'),
            envelopeHandles: [],
            eqHandles: [],
            envelopeLayout: null,
            eqLayout: null
        };
        if (!this.visualBound) {
            this.bindEnvelopeGraph();
            this.bindEqGraph();
            this.visualBound = true;
        }
        this.updateReverbVisualizers();
    }

    canvasContext(canvas) {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        }
        const context = canvas.getContext('2d');
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        return { context, width, height };
    }

    drawGrid(context, width, height, columns = 5, rows = 4) {
        context.strokeStyle = 'rgba(120,150,180,0.13)';
        context.lineWidth = 1;
        for (let i = 0; i <= columns; i++) {
            const x = width * i / columns;
            context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
        }
        for (let i = 0; i <= rows; i++) {
            const y = height * i / rows;
            context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
        }
    }

    drawHandle(context, x, y, color) {
        context.save();
        context.shadowColor = color;
        context.shadowBlur = 8;
        context.fillStyle = '#071019';
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fill(); context.stroke();
        context.restore();
    }

    updateReverbVisualizers() {
        if (!this.visual) return;
        this.drawReverbEnvelope();
        this.drawReverbEq();
    }

    drawReverbEnvelope() {
        const result = this.canvasContext(this.visual?.envelopeCanvas);
        if (!result) return;
        const { context, width, height } = result;
        this.drawGrid(context, width, height);
        const rvb = this.audioState.reverb;
        const preDelaySec = Math.max(0, rvb.preDelay) / 1000;
        const decay = Math.max(0.3, rvb.decay);
        const diffusion = Math.max(0, Math.min(100, rvb.diffusion));
        const mix = Math.max(0, Math.min(100, rvb.mix));
        const maxTime = Math.max(4, Math.ceil(preDelaySec + decay));
        const x0 = 18;
        const top = 16;
        const baseY = height - 20;
        const graphW = Math.max(20, width - 36);
        const graphH = Math.max(20, baseY - top);
        const preX = x0 + (Math.max(0, Math.min(150, rvb.preDelay)) / 150) * Math.min(graphW * 0.22, 80);
        const tailGraphW = graphW - (preX - x0);
        const density = 1.15 + (diffusion / 100) * 1.65;
        const endX = preX + (decay / maxTime) * tailGraphW;
        const middleP = 0.18 + (mix / 100) * 0.62;
        const middleX = preX + (decay * middleP / maxTime) * tailGraphW;
        const middleY = baseY - Math.pow(1 - middleP, density) * graphH * 0.86;

        context.fillStyle = 'rgba(0,210,255,0.12)';
        context.fillRect(x0, top, Math.max(2, preX - x0), graphH);
        const gradient = context.createLinearGradient(0, top, 0, baseY);
        gradient.addColorStop(0, 'rgba(255,180,36,.95)');
        gradient.addColorStop(1, 'rgba(255,80,20,.10)');
        context.beginPath(); context.moveTo(preX, baseY);
        for (let i = 0; i <= 240; i++) {
            const p = i / 240;
            const x = preX + (decay * p / maxTime) * tailGraphW;
            const y = baseY - Math.pow(1 - p, density) * graphH * 0.86;
            context.lineTo(x, y);
        }
        context.lineTo(endX, baseY); context.closePath(); context.fillStyle = gradient; context.fill();
        context.strokeStyle = '#ffae23'; context.lineWidth = 2; context.beginPath();
        for (let i = 0; i <= 240; i++) {
            const p = i / 240;
            const x = preX + (decay * p / maxTime) * tailGraphW;
            const y = baseY - Math.pow(1 - p, density) * graphH * 0.86;
            if (!i) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.stroke();
        const erCount = Math.round(6 + diffusion / 6);
        for (let i = 0; i < erCount; i++) {
            const p = i / Math.max(1, erCount - 1);
            const x = preX + 5 + p * Math.min(graphW * 0.28, 125);
            const barHeight = (1 - p * 0.8) * graphH * (0.35 + ((i * 37) % 10) / 20);
            context.fillStyle = 'rgba(250,204,21,.8)'; context.fillRect(x, baseY - barHeight, 2, barHeight);
        }
        context.fillStyle = `rgba(160,90,255,${0.03 + mix / 1000})`; context.fillRect(x0, top, graphW, graphH);
        const preY = baseY - graphH * 0.86;
        this.drawHandle(context, preX, preY, '#22d3ee');
        this.drawHandle(context, middleX, middleY, '#ffb020');
        this.drawHandle(context, endX, baseY - 5, '#c084fc');
        context.fillStyle = '#94a3b8'; context.font = '9px monospace';
        context.fillText(`Pre ${Math.round(rvb.preDelay)}ms`, x0 + 2, height - 5);
        context.fillText(`Decay ${decay.toFixed(1)}s`, Math.max(x0 + 70, width - 150), height - 5);
        this.visual.envelopeHandles = [
            { type: 'preDelay', x: preX, y: preY },
            { type: 'shape', x: middleX, y: middleY },
            { type: 'tail', x: endX, y: baseY - 5 }
        ];
        this.visual.envelopeLayout = { x0, top, baseY, graphW, graphH, maxTime, preX, tailGraphW };
    }

    drawReverbEq() {
        const result = this.canvasContext(this.visual?.eqCanvas);
        if (!result) return;
        const { context, width, height } = result;
        this.drawGrid(context, width, height, 6, 4);
        const rvb = this.audioState.reverb;
        const padX = 16;
        const top = 14;
        const graphW = Math.max(20, width - 32);
        const graphH = Math.max(20, height - 32);
        const centerY = top + graphH / 2;
        const gainToY = (gain) => centerY - gain * (graphH / 24);
        const freqToX = (freq) => padX + ((Math.log10(freq) - Math.log10(16)) / (Math.log10(16000) - Math.log10(16))) * graphW;
        const curve = [];
        for (let i = 0; i <= 180; i++) {
            const p = i / 180;
            const freq = Math.pow(10, Math.log10(16) + p * (Math.log10(16000) - Math.log10(16)));
            const lowShape = 1 / (1 + Math.pow(freq / 250, 2));
            const highShape = 1 / (1 + Math.pow(4000 / freq, 2));
            curve.push({ x: padX + p * graphW, y: gainToY(rvb.lowGain * lowShape + rvb.highGain * highShape) });
        }
        context.beginPath(); context.moveTo(curve[0].x, centerY); curve.forEach((point) => context.lineTo(point.x, point.y)); context.lineTo(curve[curve.length - 1].x, centerY); context.closePath();
        context.fillStyle = 'rgba(0,210,255,.15)'; context.fill();
        context.beginPath(); curve.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.strokeStyle = '#18d4ff'; context.lineWidth = 2; context.stroke();
        const lowX = freqToX(250); const highX = freqToX(4000);
        const lowY = gainToY(rvb.lowGain); const highY = gainToY(rvb.highGain);
        this.drawHandle(context, lowX, lowY, '#ffb020'); this.drawHandle(context, highX, highY, '#25d0ff');
        this.visual.eqHandles = [{ type: 'lowGain', x: lowX, y: lowY }, { type: 'highGain', x: highX, y: highY }];
        this.visual.eqLayout = { top, graphH, centerY };
    }

    setGraphValue(key, value, rebuildImpulse = false, final = false) {
        const inputIds = { preDelay: 'reverb-predelay', decay: 'reverb-decay', diffusion: 'reverb-diffusion', mix: 'reverb-mix', lowGain: 'reverb-low', highGain: 'reverb-high' };
        const input = document.getElementById(inputIds[key]);
        if (!input) return;
        const min = Number(input.min); const max = Number(input.max); const step = Number(input.step || 1);
        const precision = Math.max(0, (String(input.step).split('.')[1] || '').length);
        const clamped = Math.max(min, Math.min(max, value));
        const stepped = Math.round(clamped / step) * step;
        this.audioState.reverb[key] = Number(stepped.toFixed(precision));
        input.value = String(this.audioState.reverb[key]);
        this.updateUI(this.updateRangeFillCallback);
        const binding = this.liveBinding;
        if (binding?.getPlayStateCallback?.()) this.applySettings(binding.context, binding.getBypassStateCallback, rebuildImpulse && final);
    }

    nearestHandle(handles, x, y) {
        return handles.reduce((nearest, handle) => {
            const distance = Math.hypot(handle.x - x, handle.y - y);
            return !nearest || distance < nearest.distance ? { ...handle, distance } : nearest;
        }, null);
    }

    pointerPosition(canvas, event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    bindEnvelopeGraph() {
        const canvas = this.visual?.envelopeCanvas;
        if (!canvas) return;
        canvas.onpointerdown = (event) => {
            if (event.button !== 0) return;
            const point = this.pointerPosition(canvas, event);
            const handle = this.nearestHandle(this.visual.envelopeHandles, point.x, point.y);
            this.graphDrag = { canvas, type: handle?.type || 'shape', pointerId: event.pointerId };
            canvas.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        };
        canvas.onpointermove = (event) => {
            if (!this.graphDrag || this.graphDrag.canvas !== canvas) return;
            const point = this.pointerPosition(canvas, event);
            const layout = this.visual.envelopeLayout;
            const rvb = this.audioState.reverb;
            const pointX = Math.max(layout.x0, Math.min(layout.x0 + layout.graphW, point.x));
            const pointY = Math.max(layout.top, Math.min(layout.baseY, point.y));
            const time = ((pointX - layout.preX) / layout.tailGraphW) * layout.maxTime;
            if (this.graphDrag.type === 'preDelay') {
                const preDelay = ((pointX - layout.x0) / Math.min(layout.graphW * 0.22, 80)) * 150;
                this.setGraphValue('preDelay', preDelay);
            }
            else if (this.graphDrag.type === 'tail') {
                this.setGraphValue('decay', time - rvb.preDelay / 1000);
            }
            else {
                const decaySec = Math.max(0.3, rvb.decay);
                const relativeInDecay = decaySec
                    ? (((pointX - layout.preX) / layout.tailGraphW) * layout.maxTime) / decaySec
                    : 0.45;
                const mixFromX = ((Math.max(0.18, Math.min(0.8, relativeInDecay)) - 0.18) / 0.62) * 100;
                const vertical = Math.max(0, Math.min(1, (layout.baseY - pointY) / layout.graphH));
                const diffusionFromY = vertical * 100;
                this.setGraphValue('mix', mixFromX);
                this.setGraphValue('diffusion', diffusionFromY);
            }
        };
        const finish = (event) => {
            if (!this.graphDrag || this.graphDrag.canvas !== canvas) return;
            if (this.liveBinding?.context && this.liveBinding.getPlayStateCallback?.()) {
                this.applySettings(this.liveBinding.context, this.liveBinding.getBypassStateCallback, true);
            }
            this.graphDrag = null;
            if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        };
        canvas.onpointerup = finish; canvas.onpointercancel = finish;
    }

    bindEqGraph() {
        const canvas = this.visual?.eqCanvas;
        if (!canvas) return;
        canvas.onpointerdown = (event) => {
            if (event.button !== 0) return;
            const point = this.pointerPosition(canvas, event);
            const handle = this.nearestHandle(this.visual.eqHandles, point.x, point.y);
            this.graphDrag = { canvas, type: handle?.type || (point.x < canvas.getBoundingClientRect().width / 2 ? 'lowGain' : 'highGain'), pointerId: event.pointerId };
            canvas.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        };
        canvas.onpointermove = (event) => {
            if (!this.graphDrag || this.graphDrag.canvas !== canvas) return;
            const point = this.pointerPosition(canvas, event);
            const layout = this.visual.eqLayout;
            const gain = (layout.centerY - point.y) / (layout.graphH / 24);
            this.setGraphValue(this.graphDrag.type, gain);
        };
        const finish = (event) => {
            if (!this.graphDrag || this.graphDrag.canvas !== canvas) return;
            this.graphDrag = null;
            if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        };
        canvas.onpointerup = finish; canvas.onpointercancel = finish;
    }

    bindLiveControls(context, getPlayStateCallback, getBypassStateCallback, updateRangeFillCallback) {
        this.liveBinding = { context, getPlayStateCallback, getBypassStateCallback };
        this.updateRangeFillCallback = updateRangeFillCallback || this.updateRangeFillCallback;
        const reverbToggle = document.getElementById('reverb-toggle');
        if (reverbToggle) {
            reverbToggle.onclick = () => {
                this.audioState.reverb.enabled = !this.audioState.reverb.enabled;
                this.updateUI(updateRangeFillCallback);
                if (getPlayStateCallback()) this.applySettings(context, getBypassStateCallback);
            };
        }

        const reverbPreset = document.getElementById('reverb-preset');
        const reverbTemplateName = document.getElementById('reverb-template-name');
        const reverbTemplateSave = document.getElementById('reverb-template-save');

        if (reverbPreset) {
            reverbPreset.onchange = (e) => {
                const value = e.target.value;
                if (!value) return;
                const [type, rawKey] = value.split(':');
                const customPresets = this.getCustomPresets();
                const preset = type === 'default'
                    ? this.presets[rawKey]
                    : customPresets[Number(rawKey)];
                if (!preset) return;

                const settings = type === 'default' ? preset : preset.settings;

                this.audioState.reverb = this.cloneSettings(settings);
                this.syncInputs();
                this.updateUI(updateRangeFillCallback);
                if (getPlayStateCallback()) this.applySettings(context, getBypassStateCallback, true);
                if (reverbTemplateName) reverbTemplateName.value = preset.name;
            };
        }

        if (reverbTemplateSave) {
            reverbTemplateSave.onclick = () => {
                const name = (reverbTemplateName && reverbTemplateName.value.trim()) || `Custom ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                const customPresets = this.getCustomPresets();
                const existingIdx = customPresets.findIndex(p => p.name === name);
                const nextPreset = { name, settings: this.cloneSettings() };
                if (existingIdx >= 0) customPresets[existingIdx] = nextPreset;
                else customPresets.push(nextPreset);
                this.setCustomPresets(customPresets);
                this.populatePresets('reverb-preset');
                if (reverbPreset) reverbPreset.value = `custom:${existingIdx >= 0 ? existingIdx : customPresets.length - 1}`;
                if (reverbTemplateName) reverbTemplateName.value = name;
            };
        }

        const reverbControls = [
            { id: 'reverb-predelay', key: 'preDelay', rebuild: false },
            { id: 'reverb-decay', key: 'decay', rebuild: true },
            { id: 'reverb-diffusion', key: 'diffusion', rebuild: true },
            { id: 'reverb-mix', key: 'mix', rebuild: false },
            { id: 'reverb-low', key: 'lowGain', rebuild: false },
            { id: 'reverb-high', key: 'highGain', rebuild: false }
        ];

        this.initTouchSteppers(reverbControls);
        reverbControls.forEach(({ id, key, rebuild }) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.oninput = (e) => {
                this.audioState.reverb[key] = parseFloat(e.target.value);
                this.updateUI(updateRangeFillCallback);
                if (getPlayStateCallback()) this.applySettings(context, getBypassStateCallback, rebuild);
            };
        });
    }

    initTouchSteppers(reverbControls) {
        reverbControls.forEach(({ id }) => {
            const input = document.getElementById(id);
            if (!input || input.type !== 'range' || input.dataset.stepperReady === 'true') return;
            input.dataset.stepperReady = 'true';

            const wrapper = document.createElement('div');
            wrapper.className = 'reverb-stepper';

            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'reverb-step-btn';
            minus.dataset.stepDir = '-1';
            minus.setAttribute('aria-label', `${id} decrease`);
            minus.textContent = '−';

            const plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'reverb-step-btn';
            plus.dataset.stepDir = '1';
            plus.setAttribute('aria-label', `${id} increase`);
            plus.textContent = '+';

            input.parentNode.insertBefore(wrapper, input);
            wrapper.append(minus, input, plus);

            const nudge = (direction) => {
                const min = Number(input.min || 0);
                const max = Number(input.max || 100);
                const step = Number(input.step || 1) || 1;
                const current = Number(input.value || 0);
                const next = Math.max(min, Math.min(max, current + direction * step));
                input.value = String(step < 1 ? Number(next.toFixed(3)) : Math.round(next));
                input.dispatchEvent(new Event('input', { bubbles: true }));
            };

            [minus, plus].forEach((button) => {
                let repeatDelayTimer = 0;
                let repeatTimer = 0;
                const direction = Number(button.dataset.stepDir);
                const clearRepeat = () => {
                    window.clearTimeout(repeatDelayTimer);
                    window.clearInterval(repeatTimer);
                    repeatDelayTimer = 0;
                    repeatTimer = 0;
                };
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    nudge(direction);
                });
                button.addEventListener('pointerdown', (event) => {
                    event.preventDefault();
                    button.setPointerCapture?.(event.pointerId);
                    repeatDelayTimer = window.setTimeout(() => {
                        repeatTimer = window.setInterval(() => nudge(direction), 80);
                    }, 360);
                });
                button.addEventListener('pointerup', clearRepeat);
                button.addEventListener('pointercancel', clearRepeat);
                button.addEventListener('pointerleave', clearRepeat);
            });
        });
    }

    getSettings() {
        return { ...this.audioState.reverb };
    }

    setSettings(settings) {
        if (settings) {
            this.audioState.reverb = { ...settings };
        }
    }
}
