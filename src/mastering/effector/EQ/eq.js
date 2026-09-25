class EQEffector {
    constructor(audioState) {
        this.audioState = audioState;
        this.frequencies = [
            20, 31.5, 50, 80, 125,
            200, 315, 500, 800, 1000,
            1250, 2000, 3150, 4000, 5000,
            6300, 8000, 10000, 12500, 16000
        ];
        this.labels = [
            "20", "31.5", "50", "80", "125",
            "200", "315", "500", "800", "1k",
            "1.25k", "2k", "3.15k", "4k", "5k",
            "6.3k", "8k", "10k", "12.5k", "16k"
        ];
        this.legacyFrequencies = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        this.minGain = -12;
        this.maxGain = 12;
        this.qValue = 1.15;
        this.filters = [];
        this.analyserInput = null;
        this.analyserOutput = null;
        this.spectrumData = null;
        this.canvas = null;
        this.canvasContext = null;
        this.animationId = 0;
        this.dragBandIndex = -1;
        this.controlContext = null;
        this.getPlayState = () => false;
        this.getBypassState = () => true;
        this.resizeObserver = null;
        this.userPresetStorageKey = "jd-eq-user-presets-v1";
        this.presets = {
            flat: new Array(20).fill(0),
            warm: [1.2, 1.5, 1.8, 2.1, 1.8, 1.2, 0.5, 0, -0.4, -0.5, -0.3, 0, 0.4, 0.8, 1.1, 1.4, 1.6, 1.8, 1.6, 1.2],
            vocal: [-2.2, -1.8, -1.2, -0.6, 0, -0.8, -1.2, -0.5, 0.6, 1.1, 1.6, 2.6, 3.2, 2.8, 2.1, 1.4, 0.8, 0.4, 0, -0.4],
            punch: [1.8, 2.4, 2.8, 2.2, 1.1, -0.6, -1.2, -0.8, 0.2, 0.7, 1.1, 1.8, 2.4, 2.1, 1.5, 0.8, 0.3, 0, -0.4, -0.8],
            clarity: [-1.5, -1.2, -0.8, -0.4, 0, 0.3, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.4, 2.2, 1.8, 1.4, 1.1, 0.8, 0.5, 0.2],
            smile: [2.4, 2.6, 2.3, 1.8, 1.1, 0.2, -0.8, -1.5, -2.1, -2.3, -2, -1.2, -0.2, 0.8, 1.6, 2.2, 2.7, 3, 3.2, 3.4],
            masteringBalanced: [-0.4, -0.3, -0.1, 0.2, 0.3, 0.0, -0.2, -0.3, -0.1, 0.1, 0.3, 0.6, 0.8, 0.9, 0.8, 0.7, 0.6, 0.5, 0.3, 0.1],
            masteringLoudness: [0.3, 0.5, 0.8, 1.0, 0.7, -0.2, -0.7, -0.8, -0.4, 0.0, 0.4, 0.9, 1.2, 1.3, 1.1, 0.8, 0.5, 0.2, 0.0, -0.2],
            popModern: [-0.5, -0.3, 0.2, 0.8, 0.7, 0.1, -0.5, -0.7, -0.3, 0.2, 0.7, 1.2, 1.7, 1.8, 1.5, 1.2, 0.9, 0.7, 0.5, 0.2],
            kpopBright: [-0.7, -0.5, 0.1, 0.7, 0.5, -0.1, -0.6, -0.8, -0.3, 0.3, 0.8, 1.4, 2.0, 2.1, 1.8, 1.5, 1.2, 1.0, 0.8, 0.4],
            balladVocal: [-0.8, -0.6, -0.3, 0.0, 0.2, 0.1, -0.3, -0.4, 0.0, 0.4, 0.9, 1.6, 2.0, 1.8, 1.4, 0.9, 0.5, 0.2, 0.0, -0.3],
            acousticNatural: [-0.9, -0.6, -0.2, 0.3, 0.5, 0.4, 0.1, -0.2, 0.0, 0.3, 0.6, 1.0, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2, 0.0, -0.2],
            rockPunch: [0.2, 0.5, 0.9, 1.2, 0.8, -0.1, -0.6, -0.8, -0.4, 0.1, 0.5, 1.0, 1.6, 1.8, 1.5, 1.0, 0.5, 0.1, -0.2, -0.5],
            punkRock: [-0.6, -0.3, 0.32, 1.07, 7.16, 2.4, 3.37, -0.53, -2.24, -0.1, 5.82, 2.52, 2.76, -3.34, -3.58, -2.24, -1.07, -1.36, -0.8, -0.6],
            metalTight: [-0.6, -0.3, 0.3, 0.9, 0.6, -0.4, -1.0, -1.2, -0.6, -0.1, 0.5, 1.2, 1.9, 2.1, 1.8, 1.3, 0.8, 0.3, -0.1, -0.4],
            hiphop808: [1.0, 1.3, 1.6, 1.4, 0.8, -0.1, -0.7, -0.9, -0.5, -0.1, 0.2, 0.6, 1.0, 1.1, 0.9, 0.7, 0.5, 0.3, 0.1, -0.2],
            edmClub: [0.8, 1.1, 1.4, 1.6, 1.0, 0.1, -0.7, -1.0, -0.7, -0.2, 0.3, 0.9, 1.5, 1.8, 1.8, 1.7, 1.5, 1.2, 0.9, 0.5],
            rnbSmooth: [0.2, 0.4, 0.7, 0.8, 0.5, 0.0, -0.4, -0.5, -0.2, 0.2, 0.6, 1.1, 1.4, 1.3, 1.0, 0.7, 0.5, 0.4, 0.3, 0.1],
            jazzWarm: [-0.5, -0.3, 0.0, 0.4, 0.7, 0.8, 0.5, 0.1, -0.1, 0.0, 0.3, 0.6, 0.8, 0.7, 0.5, 0.3, 0.1, -0.1, -0.3, -0.5],
            orchestralWide: [-0.7, -0.5, -0.2, 0.2, 0.3, 0.2, 0.0, -0.1, 0.0, 0.2, 0.5, 0.8, 1.1, 1.2, 1.1, 1.0, 0.9, 0.8, 0.6, 0.3],
            podcastVoice: [-2.0, -1.8, -1.3, -0.8, -0.4, -0.2, -0.3, -0.2, 0.2, 0.7, 1.1, 1.8, 2.2, 1.8, 1.2, 0.5, 0.0, -0.4, -0.8, -1.2],
            streamingSafe: [-0.3, -0.2, 0.0, 0.2, 0.2, 0.0, -0.3, -0.4, -0.2, 0.0, 0.3, 0.6, 0.8, 0.8, 0.6, 0.4, 0.2, 0.0, -0.1, -0.3]
        };
        this.presetLabels = {
            flat: "Flat",
            warm: "Warm Master",
            vocal: "Vocal Clarity",
            punch: "Punch & Impact",
            clarity: "Clean Detail",
            smile: "Modern Smile",
            masteringBalanced: "Mastering Balanced",
            masteringLoudness: "Mastering Loudness",
            popModern: "Pop Modern",
            kpopBright: "K-Pop Bright",
            balladVocal: "Ballad Vocal",
            acousticNatural: "Acoustic Natural",
            rockPunch: "Rock Punch",
            punkRock: "Punk Rock",
            metalTight: "Metal Tight",
            hiphop808: "Hip-Hop 808",
            edmClub: "EDM Club",
            rnbSmooth: "R&B Smooth",
            jazzWarm: "Jazz Warm",
            orchestralWide: "Orchestral Wide",
            podcastVoice: "Podcast Voice",
            streamingSafe: "Streaming Safe"
        };

        this.audioState.eq = this.normalizeEQValues(this.audioState.eq);
        if (this.audioState.eqEnabled === undefined) this.audioState.eqEnabled = false;
    }

    getBuiltinPresetOrder() {
        return [
            "flat", "streamingSafe", "masteringBalanced", "masteringLoudness",
            "popModern", "kpopBright", "balladVocal", "acousticNatural",
            "rockPunch", "punkRock", "metalTight", "hiphop808", "edmClub",
            "rnbSmooth", "jazzWarm", "orchestralWide", "podcastVoice",
            "warm", "vocal", "punch", "clarity", "smile"
        ];
    }

    loadUserPresets() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.userPresetStorageKey) || "{}");
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
            return Object.fromEntries(Object.entries(parsed).map(([name, values]) => [name, this.normalizeEQValues(values)]));
        } catch (error) {
            return {};
        }
    }

    saveUserPresets(presets) {
        try {
            localStorage.setItem(this.userPresetStorageKey, JSON.stringify(presets));
        } catch (error) {}
    }

    populatePresetSelect(selectedValue = "builtin:flat") {
        const select = document.getElementById("eq-preset-select");
        if (!select) return;
        const userPresets = this.loadUserPresets();
        select.innerHTML = "";

        const builtinGroup = document.createElement("optgroup");
        builtinGroup.label = "Mastering Presets";
        this.getBuiltinPresetOrder().forEach((key) => {
            if (!this.presets[key]) return;
            const option = document.createElement("option");
            option.value = `builtin:${key}`;
            option.textContent = this.presetLabels[key] || key;
            builtinGroup.appendChild(option);
        });
        select.appendChild(builtinGroup);

        const userGroup = document.createElement("optgroup");
        userGroup.label = "User Saved";
        Object.keys(userPresets).sort((a, b) => a.localeCompare(b)).forEach((name) => {
            const option = document.createElement("option");
            option.value = `user:${name}`;
            option.textContent = `★ ${name}`;
            userGroup.appendChild(option);
        });
        if (userGroup.children.length) select.appendChild(userGroup);

        select.value = [...select.options].some((option) => option.value === selectedValue) ? selectedValue : "builtin:flat";
        this.updateDeleteButtonState();
    }

    applyPresetByValue(value) {
        const [kind, key] = String(value || "builtin:flat").split(":");
        const values = kind === "user" ? this.loadUserPresets()[key] : this.presets[key];
        if (!values) return;
        this.audioState.eqEnabled = key !== "flat";
        this.applyPreset(values);
    }

    saveCurrentPresetFromUI() {
        const input = document.getElementById("eq-preset-name");
        const select = document.getElementById("eq-preset-select");
        const name = String(input?.value || "").trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").slice(0, 40);
        if (!name) {
            if (input) input.focus();
            return;
        }
        const userPresets = this.loadUserPresets();
        userPresets[name] = this.normalizeEQValues(this.audioState.eq);
        this.saveUserPresets(userPresets);
        this.populatePresetSelect(`user:${name}`);
        if (select) select.value = `user:${name}`;
        if (input) input.value = "";
    }

    deleteSelectedUserPreset() {
        const select = document.getElementById("eq-preset-select");
        const value = select?.value || "";
        if (!value.startsWith("user:")) return;
        const name = value.slice(5);
        const userPresets = this.loadUserPresets();
        delete userPresets[name];
        this.saveUserPresets(userPresets);
        this.populatePresetSelect("builtin:flat");
    }

    updateDeleteButtonState() {
        const select = document.getElementById("eq-preset-select");
        const deleteButton = document.getElementById("eq-preset-delete");
        if (deleteButton) deleteButton.disabled = !String(select?.value || "").startsWith("user:");
    }

    normalizeEQValues(values) {
        if (!Array.isArray(values) || values.length === 0) return new Array(this.frequencies.length).fill(0);
        if (values.length === this.frequencies.length) {
            return values.map((value) => this.clampGain(value));
        }
        if (values.length === this.legacyFrequencies.length) {
            return this.frequencies.map((frequency) => {
                if (frequency <= this.legacyFrequencies[0]) return this.clampGain(values[0]);
                const lastIndex = this.legacyFrequencies.length - 1;
                if (frequency >= this.legacyFrequencies[lastIndex]) return this.clampGain(values[lastIndex]);
                const upperIndex = this.legacyFrequencies.findIndex((candidate) => candidate >= frequency);
                const lowerIndex = Math.max(0, upperIndex - 1);
                const lowerFrequency = this.legacyFrequencies[lowerIndex];
                const upperFrequency = this.legacyFrequencies[upperIndex];
                const ratio = (Math.log(frequency) - Math.log(lowerFrequency))
                    / (Math.log(upperFrequency) - Math.log(lowerFrequency));
                return this.clampGain(Number(values[lowerIndex] || 0)
                    + ((Number(values[upperIndex] || 0) - Number(values[lowerIndex] || 0)) * ratio));
            });
        }
        return this.frequencies.map((_, index) => this.clampGain(values[index] || 0));
    }

    clampGain(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(this.minGain, Math.min(this.maxGain, Math.round(numeric * 100) / 100));
    }

    renderUI(containerId) {
        const sliderContainer = document.getElementById(containerId);
        if (!sliderContainer) return;
        this.audioState.eq = this.normalizeEQValues(this.audioState.eq);
        sliderContainer.innerHTML = "";

        this.frequencies.forEach((_, index) => {
            const wrapper = document.createElement("div");
            wrapper.className = `eq-slider-wrap eq-zone-${this.getZoneName(index)}`;
            wrapper.innerHTML = `
                <span class="eq-band-frequency">${this.labels[index]}</span>
                <span class="eq-band-value" id="eq-val-${index}">${this.formatGain(this.audioState.eq[index])}</span>
                <div class="eq-slider-shell">
                    <div class="eq-zero-line"></div>
                    <div class="eq-fill" id="eq-fill-${index}"></div>
                    <input
                        type="range"
                        min="${this.minGain}"
                        max="${this.maxGain}"
                        step="0.01"
                        value="${this.audioState.eq[index]}"
                        class="vertical-slider"
                        id="eq-${index}"
                        aria-label="EQ ${this.labels[index]} hertz gain"
                    >
                </div>
            `;
            sliderContainer.appendChild(wrapper);
            this.updateSliderFill(wrapper.querySelector(`#eq-${index}`));
        });
    }

    getZoneName(index) {
        if (index <= 4) return "bass";
        if (index <= 8) return "lowmid";
        if (index <= 11) return "mid";
        if (index <= 16) return "presence";
        return "high";
    }

    getZoneColor(index, alpha = 1) {
        const colors = {
            bass: [59, 130, 246],
            lowmid: [139, 92, 246],
            mid: [34, 197, 94],
            presence: [6, 182, 212],
            high: [96, 165, 250]
        };
        const [red, green, blue] = colors[this.getZoneName(index)];
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    connect(context, inputNode, isBypassed) {
        this.filters = [];
        const disabled = isBypassed || !this.audioState.eqEnabled;
        const isRealtimeContext = (
            (typeof AudioContext !== "undefined" && context instanceof AudioContext)
            || (typeof webkitAudioContext !== "undefined" && context instanceof webkitAudioContext)
        );
        const analyserInput = context.createAnalyser();
        analyserInput.fftSize = 4096;
        analyserInput.smoothingTimeConstant = 0.82;
        analyserInput.minDecibels = -96;
        analyserInput.maxDecibels = -6;
        inputNode.connect(analyserInput);

        let lastOutputNode = analyserInput;
        this.frequencies.forEach((frequency, index) => {
            const filter = context.createBiquadFilter();
            filter.type = index === 0 ? "lowshelf" : index === this.frequencies.length - 1 ? "highshelf" : "peaking";
            filter.frequency.value = frequency;
            filter.Q.value = this.qValue;
            filter.gain.value = disabled ? 0 : this.audioState.eq[index];
            lastOutputNode.connect(filter);
            lastOutputNode = filter;
            this.filters.push(filter);
        });

        const analyserOutput = context.createAnalyser();
        analyserOutput.fftSize = 4096;
        analyserOutput.smoothingTimeConstant = 0.82;
        analyserOutput.minDecibels = -96;
        analyserOutput.maxDecibels = -6;
        lastOutputNode.connect(analyserOutput);
        if (isRealtimeContext) {
            this.analyserInput = analyserInput;
            this.analyserOutput = analyserOutput;
        }
        return analyserOutput;
    }

    applySettings(context, isBypassed) {
        if (!context) return;
        const disabled = isBypassed || !this.audioState.eqEnabled;
        this.filters.forEach((filter, index) => {
            if (!filter) return;
            filter.gain.setTargetAtTime(disabled ? 0 : this.audioState.eq[index], context.currentTime, 0.012);
            filter.Q.setTargetAtTime(this.qValue, context.currentTime, 0.012);
        });
        this.updateUI();
    }

    bindLiveControls(context, getPlayStateCallback, getBypassStateCallback) {
        this.controlContext = context;
        this.getPlayState = getPlayStateCallback || (() => false);
        this.getBypassState = getBypassStateCallback || (() => true);

        const toggle = document.getElementById("eq-toggle");
        if (toggle) {
            toggle.onclick = () => {
                this.audioState.eqEnabled = !this.audioState.eqEnabled;
                this.updateUI();
                if (this.getPlayState() && this.controlContext) {
                    this.applySettings(this.controlContext, this.getBypassState());
                }
            };
        }

        this.frequencies.forEach((_, index) => {
            const slider = document.getElementById(`eq-${index}`);
            if (!slider) return;
            slider.oninput = (event) => {
                this.setEQValue(index, event.target.value, this.controlContext, this.getPlayState, this.getBypassState);
            };
            slider.ondblclick = () => {
                this.setEQValue(index, 0, this.controlContext, this.getPlayState, this.getBypassState);
            };
        });

        const presetSelect = document.getElementById("eq-preset-select");
        if (presetSelect) {
            this.populatePresetSelect(presetSelect.value || "builtin:flat");
            presetSelect.onchange = () => {
                this.applyPresetByValue(presetSelect.value);
                this.updateDeleteButtonState();
            };
        }
        const savePresetButton = document.getElementById("eq-preset-save");
        if (savePresetButton) savePresetButton.onclick = () => this.saveCurrentPresetFromUI();
        const deletePresetButton = document.getElementById("eq-preset-delete");
        if (deletePresetButton) deletePresetButton.onclick = () => this.deleteSelectedUserPreset();
        const presetNameInput = document.getElementById("eq-preset-name");
        if (presetNameInput) {
            presetNameInput.onkeydown = (event) => {
                if (event.key === "Enter") this.saveCurrentPresetFromUI();
            };
        }

        this.bindGraphInteraction();
        this.updateUI();
    }

    applyPreset(values) {
        const normalized = this.normalizeEQValues(values);
        normalized.forEach((value, index) => {
            this.setEQValue(index, value, this.controlContext, this.getPlayState, this.getBypassState, false);
        });
        this.updateUI();
    }

    setEQValue(index, value, context, getPlayStateCallback, getBypassStateCallback, redraw = true) {
        if (index < 0 || index >= this.frequencies.length) return;
        const gain = this.clampGain(value);
        this.audioState.eq[index] = gain;
        const slider = document.getElementById(`eq-${index}`);
        if (slider) {
            slider.value = String(gain);
            this.updateSliderFill(slider);
        }
        const valueLabel = document.getElementById(`eq-val-${index}`);
        if (valueLabel) valueLabel.innerText = this.formatGain(gain);

        const isPlaying = typeof getPlayStateCallback === "function" && getPlayStateCallback();
        const isBypassed = typeof getBypassStateCallback !== "function" || getBypassStateCallback();
        if (isPlaying && context && this.filters[index]) {
            this.filters[index].gain.setTargetAtTime(
                isBypassed || !this.audioState.eqEnabled ? 0 : gain,
                context.currentTime,
                0.01
            );
        }
        if (redraw) this.drawEQCanvas();
    }

    updateSliderFill(slider) {
        if (!slider) return;
        const value = this.clampGain(slider.value);
        const zeroPercent = 50;
        const valuePercent = ((this.maxGain - value) / (this.maxGain - this.minGain)) * 100;
        const start = Math.min(zeroPercent, valuePercent);
        const end = Math.max(zeroPercent, valuePercent);
        const index = Number(slider.id.replace("eq-", ""));
        const fill = document.getElementById(`eq-fill-${index}`);
        if (!fill) return;
        fill.style.top = `${start}%`;
        fill.style.height = `${Math.max(0, end - start)}%`;
        fill.style.opacity = Math.abs(value) < 0.05 ? "0" : "1";
        fill.style.background = `linear-gradient(180deg, ${this.getZoneColor(index, 0.98)}, ${this.getZoneColor(index, 0.55)})`;
        fill.style.boxShadow = `0 0 14px ${this.getZoneColor(index, 0.45)}`;
    }

    updateSliderFills() {
        this.frequencies.forEach((_, index) => {
            this.updateSliderFill(document.getElementById(`eq-${index}`));
            const valueLabel = document.getElementById(`eq-val-${index}`);
            if (valueLabel) valueLabel.innerText = this.formatGain(this.audioState.eq[index]);
        });
    }

    initVisualizer(canvasId = "eq-response-canvas") {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.canvasContext = this.canvas.getContext("2d");
        this.bindGraphInteraction();
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver?.disconnect();
            this.resizeObserver = new ResizeObserver(() => this.drawEQCanvas());
            this.resizeObserver.observe(this.canvas);
        }
        this.drawEQCanvas();
    }

    startVisualizer() {
        if (this.animationId) return;
        let lastFrameAt = 0;
        const draw = (now = 0) => {
            const isPlaying = typeof this.getPlayState === "function" && this.getPlayState();
            if (!document.hidden && isPlaying && now - lastFrameAt >= 33) {
                lastFrameAt = now;
                this.drawEQCanvas();
            }
            this.animationId = requestAnimationFrame(draw);
        };
        this.drawEQCanvas();
        draw();
    }

    stopVisualizer() {
        if (!this.animationId) return;
        cancelAnimationFrame(this.animationId);
        this.animationId = 0;
    }

    bindGraphInteraction() {
        if (!this.canvas) return;
        this.canvas.onpointerdown = (event) => {
            if (event.button !== 0) return;
            this.dragBandIndex = this.findBandFromPointer(event);
            this.canvas.setPointerCapture?.(event.pointerId);
            this.updateBandFromPointer(event);
        };
        this.canvas.onpointermove = (event) => {
            if (this.dragBandIndex < 0) return;
            this.updateBandFromPointer(event);
        };
        const finish = (event) => {
            this.dragBandIndex = -1;
            if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
        };
        this.canvas.onpointerup = finish;
        this.canvas.onpointercancel = finish;
        this.canvas.ondblclick = (event) => {
            const index = this.findBandFromPointer(event);
            this.setEQValue(index, 0, this.controlContext, this.getPlayState, this.getBypassState);
        };
    }

    getGraphMetrics() {
        if (!this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        return {
            rect,
            width: rect.width,
            height: rect.height,
            padLeft: 48,
            padRight: 18,
            padTop: 28,
            padBottom: 28
        };
    }

    findBandFromPointer(event) {
        const metrics = this.getGraphMetrics();
        if (!metrics) return 0;
        const pointerX = event.clientX - metrics.rect.left;
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        this.frequencies.forEach((frequency, index) => {
            const x = this.freqToX(frequency, metrics.padLeft, metrics.width - metrics.padLeft - metrics.padRight);
            const distance = Math.abs(pointerX - x);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        return nearestIndex;
    }

    updateBandFromPointer(event) {
        const metrics = this.getGraphMetrics();
        if (!metrics || this.dragBandIndex < 0) return;
        const graphHeight = metrics.height - metrics.padTop - metrics.padBottom;
        const pointerY = Math.max(metrics.padTop, Math.min(metrics.padTop + graphHeight, event.clientY - metrics.rect.top));
        const gain = this.maxGain - ((pointerY - metrics.padTop) / graphHeight) * (this.maxGain - this.minGain);
        this.setEQValue(this.dragBandIndex, gain, this.controlContext, this.getPlayState, this.getBypassState);
    }

    drawEQCanvas() {
        if (!this.canvas || !this.canvasContext) return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return;
        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
        const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
        if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
        }
        const context = this.canvasContext;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, rect.width, rect.height);

        const padLeft = 48;
        const padRight = 18;
        const padTop = 28;
        const padBottom = 28;
        const graphWidth = rect.width - padLeft - padRight;
        const graphHeight = rect.height - padTop - padBottom;
        this.drawBackground(context, rect.width, rect.height, padLeft, padTop, graphWidth, graphHeight);
        this.drawSpectrum(context, padLeft, padTop, graphWidth, graphHeight);
        this.drawResponse(context, padLeft, padTop, graphWidth, graphHeight);
        this.drawHandles(context, padLeft, padTop, graphWidth, graphHeight);
    }

    drawBackground(context, width, height, padLeft, padTop, graphWidth, graphHeight) {
        const background = context.createLinearGradient(0, 0, 0, height);
        background.addColorStop(0, "#07111f");
        background.addColorStop(1, "#02060c");
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);

        const zones = [
            { label: "Bass", from: 20, to: 200, color: "#38bdf8" },
            { label: "Low-Mids", from: 200, to: 800, color: "#2dd4bf" },
            { label: "Mids", from: 800, to: 2000, color: "#84cc16" },
            { label: "High-Mids / Presence", from: 2000, to: 8000, color: "#fbbf24" },
            { label: "Highs", from: 8000, to: 20000, color: "#818cf8" }
        ];
        context.font = "600 10px Inter, sans-serif";
        context.textAlign = "center";
        zones.forEach((zone) => {
            const x1 = this.freqToX(zone.from, padLeft, graphWidth);
            const x2 = this.freqToX(zone.to, padLeft, graphWidth);
            context.strokeStyle = zone.color;
            context.globalAlpha = 0.82;
            context.beginPath();
            context.moveTo(x1 + 2, padTop - 8);
            context.lineTo(x2 - 2, padTop - 8);
            context.stroke();
            context.fillStyle = zone.color;
            context.fillText(zone.label, (x1 + x2) / 2, padTop - 13);
        });
        context.globalAlpha = 1;

        [-12, -6, 0, 6, 12].forEach((gain) => {
            const y = this.gainToY(gain, padTop, graphHeight);
            context.strokeStyle = gain === 0 ? "rgba(250,204,21,.42)" : "rgba(100,130,170,.16)";
            context.lineWidth = gain === 0 ? 1.2 : 1;
            context.beginPath();
            context.moveTo(padLeft, y);
            context.lineTo(padLeft + graphWidth, y);
            context.stroke();
            context.fillStyle = "rgba(148,163,184,.88)";
            context.font = "9px ui-monospace, monospace";
            context.textAlign = "right";
            context.fillText(gain > 0 ? `+${gain}` : String(gain), padLeft - 7, y + 3);
        });

        [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach((frequency) => {
            const x = this.freqToX(frequency, padLeft, graphWidth);
            context.strokeStyle = "rgba(100,130,170,.13)";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(x, padTop);
            context.lineTo(x, padTop + graphHeight);
            context.stroke();
            context.fillStyle = "rgba(148,163,184,.82)";
            context.font = "9px ui-monospace, monospace";
            context.textAlign = "center";
            context.fillText(this.formatFrequency(frequency), x, height - 9);
        });
    }

    drawSpectrum(context, padLeft, padTop, graphWidth, graphHeight) {
        const analyser = this.analyserOutput || this.analyserInput;
        if (!analyser) return;
        if (!this.spectrumData || this.spectrumData.length !== analyser.frequencyBinCount) {
            this.spectrumData = new Uint8Array(analyser.frequencyBinCount);
        }
        const data = this.spectrumData;
        analyser.getByteFrequencyData(data);
        const nyquist = (analyser.context?.sampleRate || 44100) / 2;
        const points = [];
        for (let index = 1; index < data.length; index++) {
            const frequency = (index * nyquist) / data.length;
            if (frequency < 20 || frequency > 20000) continue;
            const normalized = data[index] / 255;
            points.push({
                x: this.freqToX(frequency, padLeft, graphWidth),
                y: padTop + graphHeight - normalized * graphHeight * 0.88
            });
        }
        if (points.length < 2) return;
        const gradient = context.createLinearGradient(0, padTop, 0, padTop + graphHeight);
        gradient.addColorStop(0, "rgba(56,189,248,.26)");
        gradient.addColorStop(1, "rgba(30,64,175,.02)");
        context.beginPath();
        context.moveTo(points[0].x, padTop + graphHeight);
        points.forEach((point) => context.lineTo(point.x, point.y));
        context.lineTo(points[points.length - 1].x, padTop + graphHeight);
        context.closePath();
        context.fillStyle = gradient;
        context.fill();
        context.strokeStyle = "rgba(148,180,230,.42)";
        context.lineWidth = 1;
        context.beginPath();
        points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.stroke();
    }

    drawResponse(context, padLeft, padTop, graphWidth, graphHeight) {
        const points = [];
        for (let index = 0; index <= 500; index++) {
            const ratio = index / 500;
            const frequency = this.ratioToFrequency(ratio);
            points.push({
                x: padLeft + ratio * graphWidth,
                y: this.gainToY(this.calculateTotalGain(frequency), padTop, graphHeight)
            });
        }
        const zeroY = this.gainToY(0, padTop, graphHeight);
        context.beginPath();
        context.moveTo(points[0].x, zeroY);
        points.forEach((point) => context.lineTo(point.x, point.y));
        context.lineTo(points[points.length - 1].x, zeroY);
        context.closePath();
        const fill = context.createLinearGradient(0, padTop, 0, padTop + graphHeight);
        fill.addColorStop(0, "rgba(34,211,238,.28)");
        fill.addColorStop(0.5, "rgba(59,130,246,.08)");
        fill.addColorStop(1, "rgba(139,92,246,.2)");
        context.fillStyle = fill;
        context.fill();

        context.save();
        context.globalAlpha = this.audioState.eqEnabled ? 1 : 0.45;
        const line = context.createLinearGradient(padLeft, 0, padLeft + graphWidth, 0);
        line.addColorStop(0, "#38bdf8");
        line.addColorStop(0.35, "#8b5cf6");
        line.addColorStop(0.62, "#22c55e");
        line.addColorStop(1, "#38bdf8");
        context.strokeStyle = line;
        context.lineWidth = 2.4;
        context.shadowColor = "rgba(56,189,248,.65)";
        context.shadowBlur = 8;
        context.beginPath();
        points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.stroke();
        context.restore();
    }

    drawHandles(context, padLeft, padTop, graphWidth, graphHeight) {
        this.frequencies.forEach((frequency, index) => {
            const x = this.freqToX(frequency, padLeft, graphWidth);
            const y = this.gainToY(this.audioState.eq[index], padTop, graphHeight);
            context.save();
            context.shadowColor = this.getZoneColor(index, 0.85);
            context.shadowBlur = 10;
            context.fillStyle = "#0b2944";
            context.strokeStyle = this.getZoneColor(index, 1);
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(x, y, 7, 0, Math.PI * 2);
            context.fill();
            context.stroke();
            context.shadowBlur = 0;
            context.fillStyle = "#e0f2fe";
            context.font = "700 7px ui-monospace, monospace";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(String(index + 1), x, y + 0.5);
            context.restore();
        });
    }

    calculateTotalGain(frequency) {
        if (!this.audioState.eqEnabled) return 0;
        const total = this.frequencies.reduce((sum, centerFrequency, index) => {
            const distance = Math.log2(frequency / centerFrequency);
            const width = index === 0 || index === this.frequencies.length - 1 ? 1.1 : 0.46;
            const influence = Math.exp(-0.5 * Math.pow(distance / width, 2));
            return sum + this.audioState.eq[index] * influence;
        }, 0);
        return Math.max(this.minGain, Math.min(this.maxGain, total));
    }

    freqToX(frequency, padLeft, graphWidth) {
        const min = Math.log10(20);
        const max = Math.log10(20000);
        return padLeft + ((Math.log10(Math.max(20, Math.min(20000, frequency))) - min) / (max - min)) * graphWidth;
    }

    ratioToFrequency(ratio) {
        return Math.pow(10, Math.log10(20) + ratio * (Math.log10(20000) - Math.log10(20)));
    }

    gainToY(gain, padTop, graphHeight) {
        const clamped = Math.max(this.minGain, Math.min(this.maxGain, gain));
        return padTop + ((this.maxGain - clamped) / (this.maxGain - this.minGain)) * graphHeight;
    }

    formatFrequency(frequency) {
        if (frequency >= 1000) {
            const value = frequency / 1000;
            return `${Number.isInteger(value) ? value : value.toFixed(1)}k`;
        }
        return String(frequency);
    }

    formatGain(value) {
        const gain = this.clampGain(value);
        if (Math.abs(gain) < 0.005) return "0.00";
        return `${gain > 0 ? "+" : ""}${gain.toFixed(2)}`;
    }

    updateUI() {
        const toggle = document.getElementById("eq-toggle");
        if (toggle) {
            const enabled = Boolean(this.audioState.eqEnabled);
            toggle.setAttribute("aria-pressed", String(enabled));
            toggle.innerText = enabled ? "IN" : "OUT";
            toggle.className = `eq-toggle${enabled ? " is-active" : ""}`;
        }
        document.getElementById("eq-panel")?.classList.toggle("is-enabled", Boolean(this.audioState.eqEnabled));
        this.updateSliderFills();
        this.drawEQCanvas();
    }

    resetUI() {
        this.audioState.eq = new Array(this.frequencies.length).fill(0);
        this.updateSliderFills();
        const presetSelect = document.getElementById("eq-preset-select");
        if (presetSelect) presetSelect.value = "builtin:flat";
        this.applySettings(this.controlContext, this.getBypassState());
        this.updateUI();
    }

    getSettings() {
        return {
            eq: [...this.audioState.eq],
            eqEnabled: Boolean(this.audioState.eqEnabled)
        };
    }

    setSettings(settings) {
        if (!settings) return;
        if (Array.isArray(settings.eq)) this.audioState.eq = this.normalizeEQValues(settings.eq);
        if (settings.eqEnabled !== undefined) this.audioState.eqEnabled = Boolean(settings.eqEnabled);
        this.updateUI();
    }
}
