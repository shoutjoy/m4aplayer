class LimiterEffector {
    constructor(audioState) {
        this.audioState = audioState;
        this.limiterNode = null;
        this.limiterFallbackNode = null;
        this.limiterOutputGainNode = null;
        this.limiterMeterInputNode = null;
        this.limiterMeterOutputNode = null;
        
        this.limiterWorkletUrl = null;
        this.limiterWorkletReady = false;
        this.limiterWorkletContexts = new WeakSet();
        this.meterSampleBuffers = new WeakMap();
        this.limiterReductionDb = 0;
        this.visual = {
            grHistory: [],
            inputHistory: [],
            outputHistory: [],
            maxHistoryLength: 200,
            lastSampleAt: 0,
            pendingFrame: 0,
            grCanvas: null,
            transferCanvas: null,
            peakCanvas: null
        };

        this.limiterWorkletCode = `
class LookaheadLimiterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -1, minValue: -60, maxValue: 0, automationRate: "k-rate" },
      { name: "release", defaultValue: 100, minValue: 10, maxValue: 1000, automationRate: "k-rate" },
      { name: "outputGain", defaultValue: 0, minValue: -24, maxValue: 24, automationRate: "k-rate" }
    ];
  }

  constructor() {
    super();
    this.lookaheadMs = 5;
    this.lookaheadSamples = Math.max(1, Math.floor(sampleRate * this.lookaheadMs / 1000));
    this.buffers = [];
    this.writeIndex = 0;
    this.currentGain = 1;
    this.blockCount = 0;
  }

  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  ensureBuffers(channelCount) {
    while (this.buffers.length < channelCount) {
      this.buffers.push(new Float32Array(this.lookaheadSamples));
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const channelCount = Math.min(input.length, output.length);
    this.ensureBuffers(channelCount);

    const thresholdDb = parameters.threshold[0];
    const releaseMs = parameters.release[0];
    const outputGainDb = parameters.outputGain[0];
    const thresholdLinear = this.dbToLinear(thresholdDb);
    const outputGainLinear = this.dbToLinear(outputGainDb);
    const releaseCoeff = Math.exp(-1 / (sampleRate * releaseMs / 1000));
    let minGain = 1;
    let inputPeak = 0;
    let outputPeak = 0;

    for (let i = 0; i < input[0].length; i++) {
      let peak = 0;
      const readIndex = this.writeIndex;

      for (let ch = 0; ch < channelCount; ch++) {
        const sample = input[ch][i] || 0;
        if (Math.abs(sample) > peak) peak = Math.abs(sample);
      }

      inputPeak = Math.max(inputPeak, peak);
      let targetGain = peak > thresholdLinear ? thresholdLinear / peak : 1;
      if (targetGain < this.currentGain) {
        this.currentGain = targetGain;
      } else {
        this.currentGain = releaseCoeff * this.currentGain + (1 - releaseCoeff) * targetGain;
      }
      minGain = Math.min(minGain, this.currentGain);

      for (let ch = 0; ch < channelCount; ch++) {
        const delayed = this.buffers[ch][readIndex];
        this.buffers[ch][readIndex] = input[ch][i] || 0;
        const out = delayed * this.currentGain * outputGainLinear;
        output[ch][i] = out;
        outputPeak = Math.max(outputPeak, Math.abs(out));
      }

      this.writeIndex++;
      if (this.writeIndex >= this.lookaheadSamples) this.writeIndex = 0;
    }

    this.blockCount++;
    if (this.blockCount % 24 === 0) {
      const reductionDb = -20 * Math.log10(Math.max(minGain, 0.000001));
      const inputDb = 20 * Math.log10(Math.max(inputPeak, 0.000001));
      const outputDb = 20 * Math.log10(Math.max(outputPeak, 0.000001));
      this.port.postMessage({ reductionDb, inputDb, outputDb });
    }

    return true;
  }
}

registerProcessor("lookahead-limiter", LookaheadLimiterProcessor);
`;
    }

    async ensureLimiterWorklet(context) {
        if (!context.audioWorklet) return false;
        if (this.limiterWorkletContexts.has(context)) return true;
        if (!this.limiterWorkletUrl) {
            const blob = new Blob([this.limiterWorkletCode], { type: 'application/javascript' });
            this.limiterWorkletUrl = URL.createObjectURL(blob);
        }
        await context.audioWorklet.addModule(this.limiterWorkletUrl);
        this.limiterWorkletReady = true;
        this.limiterWorkletContexts.add(context);
        return true;
    }

    dbToGain(db) {
        return Math.pow(10, db / 20);
    }

    async connect(context, inputNode, getBypassStateCallback) {
        this.limiterNode = null;
        this.limiterFallbackNode = null;
        this.limiterOutputGainNode = null;

        this.limiterMeterInputNode = context.createAnalyser();
        this.limiterMeterInputNode.fftSize = 256;
        this.limiterMeterOutputNode = context.createAnalyser();
        this.limiterMeterOutputNode.fftSize = 256;

        inputNode.connect(this.limiterMeterInputNode);
        let lastOutputNode = this.limiterMeterInputNode;

        try {
            const workletAvailable = await this.ensureLimiterWorklet(context);
            if (!workletAvailable) throw new Error('AudioWorklet unavailable');
            
            this.limiterNode = new AudioWorkletNode(context, 'lookahead-limiter', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                parameterData: {
                    threshold: this.audioState.limiter.threshold,
                    release: this.audioState.limiter.release,
                    outputGain: this.audioState.limiter.outputGain
                }
            });
            this.limiterNode.port.onmessage = (event) => {
                const reductionDb = Number.isFinite(event.data.reductionDb) ? event.data.reductionDb : 0;
                const inputDb = Number.isFinite(event.data.inputDb) ? event.data.inputDb : -Infinity;
                const outputDb = Number.isFinite(event.data.outputDb) ? event.data.outputDb : -Infinity;
                this.limiterReductionDb = reductionDb;
                const limiterInVal = document.getElementById('limiter-in-val');
                const limiterOutVal = document.getElementById('limiter-out-val');
                const limiterGrVal = document.getElementById('limiter-gr-val');
                if (limiterInVal) limiterInVal.innerText = Number.isFinite(inputDb) ? `${inputDb.toFixed(1)} dB` : '-inf';
                if (limiterOutVal) limiterOutVal.innerText = Number.isFinite(outputDb) ? `${outputDb.toFixed(1)} dB` : '-inf';
                if (limiterGrVal) limiterGrVal.innerText = `${reductionDb.toFixed(1)} dB`;
                this.pushLimiterVisualSample(inputDb, outputDb, reductionDb);
            };
            this.applySettings(context, getBypassStateCallback);
            lastOutputNode.connect(this.limiterNode);
            this.limiterNode.connect(this.limiterMeterOutputNode);
            lastOutputNode = this.limiterNode;
        } catch (error) {
            this.limiterFallbackNode = context.createDynamicsCompressor();
            this.limiterOutputGainNode = context.createGain();
            this.applySettings(context, getBypassStateCallback);
            lastOutputNode.connect(this.limiterFallbackNode);
            this.limiterFallbackNode.connect(this.limiterOutputGainNode);
            this.limiterOutputGainNode.connect(this.limiterMeterOutputNode);
            lastOutputNode = this.limiterOutputGainNode;
        }

        return lastOutputNode;
    }

    applySettings(context, getBypassStateCallback) {
        const lim = this.audioState.limiter;
        const disabled = getBypassStateCallback() || !lim.enabled;
        const now = context.currentTime;

        if (this.limiterNode && this.limiterNode.parameters) {
            this.limiterNode.parameters.get('threshold').setValueAtTime(disabled ? 0 : lim.threshold, now);
            this.limiterNode.parameters.get('release').setValueAtTime(disabled ? 100 : lim.release, now);
            this.limiterNode.parameters.get('outputGain').setValueAtTime(disabled ? 0 : lim.outputGain, now);
        }

        if (this.limiterFallbackNode && this.limiterOutputGainNode) {
            this.limiterFallbackNode.threshold.setValueAtTime(disabled ? 0 : lim.threshold, now);
            this.limiterFallbackNode.knee.setValueAtTime(0, now);
            this.limiterFallbackNode.ratio.setValueAtTime(disabled ? 1 : 20, now);
            this.limiterFallbackNode.attack.setValueAtTime(0.001, now);
            this.limiterFallbackNode.release.setValueAtTime(disabled ? 0.1 : lim.release / 1000, now);
            this.limiterOutputGainNode.gain.setValueAtTime(disabled ? 1 : this.dbToGain(lim.outputGain), now);
        }
    }

    updateUI(updateRangeFillCallback) {
        const lim = this.audioState.limiter;
        const limiterToggle = document.getElementById('limiter-toggle');
        if (limiterToggle) {
            limiterToggle.setAttribute('aria-pressed', String(lim.enabled));
            limiterToggle.innerText = lim.enabled ? 'IN' : 'OUT';
            limiterToggle.className = lim.enabled
                ? "bg-lime-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-lime-500 shadow-md transition"
                : "bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-gray-700 transition";
        }
        const threshVal = document.getElementById('limiter-threshold-val');
        const releaseVal = document.getElementById('limiter-release-val');
        const outputVal = document.getElementById('limiter-output-val');

        if (threshVal) threshVal.innerText = `${lim.threshold.toFixed(1)} dB`;
        if (releaseVal) releaseVal.innerText = `${Math.round(lim.release)} ms`;
        if (outputVal) outputVal.innerText = `${lim.outputGain.toFixed(1)} dB`;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('limiter-output-change', {
                detail: {
                    enabled: Boolean(lim.enabled),
                    outputGain: Number(lim.outputGain) || 0
                }
            }));
        }

        if (updateRangeFillCallback) {
            updateRangeFillCallback();
        }
        this.scheduleVisualizerUpdate();
    }

    updateMeters(getBypassStateCallback) {
        const limiterInBar = document.getElementById('limiter-in-bar');
        const limiterOutBar = document.getElementById('limiter-out-bar');
        const limiterGrBar = document.getElementById('limiter-gr-bar');
        const limiterInVal = document.getElementById('limiter-in-val');
        const limiterOutVal = document.getElementById('limiter-out-val');
        const limiterGrVal = document.getElementById('limiter-gr-val');

        const getAnalyserRmsDb = (analyser) => {
            if (!analyser) return -Infinity;
            let data = this.meterSampleBuffers.get(analyser);
            if (!data || data.length !== analyser.fftSize) {
                data = new Float32Array(analyser.fftSize);
                this.meterSampleBuffers.set(analyser, data);
            }
            analyser.getFloatTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
            const rms = Math.sqrt(sum / data.length);
            return 20 * Math.log10(rms + 0.000001);
        };

        const isEnabled = this.audioState.limiter.enabled && !getBypassStateCallback();

        const inputDb = isEnabled ? getAnalyserRmsDb(this.limiterMeterInputNode) : -Infinity;
        const outputDb = isEnabled ? getAnalyserRmsDb(this.limiterMeterOutputNode) : -Infinity;
        const grDb = isEnabled ? Math.max(0, this.limiterFallbackNode ? Math.abs(this.limiterFallbackNode.reduction || 0) : this.limiterReductionDb) : 0;

        const normalize = (db) => Math.max(0, Math.min(100, (db + 60) * (100 / 60)));

        if (limiterInBar) limiterInBar.style.width = normalize(inputDb) + "%";
        if (limiterOutBar) limiterOutBar.style.width = normalize(outputDb) + "%";
        if (limiterGrBar) limiterGrBar.style.width = Math.min(100, (grDb / 24) * 100) + "%";
        
        if (limiterInVal) limiterInVal.innerText = Number.isFinite(inputDb) ? `${inputDb.toFixed(1)} dB` : "-inf";
        if (limiterOutVal) limiterOutVal.innerText = Number.isFinite(outputDb) ? `${outputDb.toFixed(1)} dB` : "-inf";
        if (limiterGrVal) limiterGrVal.innerText = grDb.toFixed(1) + " dB";
        if (this.limiterFallbackNode || !this.limiterNode) {
            this.pushLimiterVisualSample(inputDb, outputDb, grDb);
        }
    }

    initVisualizers() {
        this.visual.grCanvas = document.getElementById('limiter-gr-history-canvas');
        this.visual.transferCanvas = document.getElementById('limiter-transfer-canvas');
        this.visual.peakCanvas = document.getElementById('limiter-peak-trace-canvas');
        this.updateLimiterVisualizers();
    }

    getCeilingDb() {
        const lim = this.audioState.limiter;
        return Number(lim.threshold || 0) + Number(lim.outputGain || 0);
    }

    pushLimiterVisualSample(inputDb, outputDb, reductionDb) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - this.visual.lastSampleAt < 45) return;
        this.visual.lastSampleAt = now;
        this.visual.inputHistory.push(Number.isFinite(inputDb) ? inputDb : -60);
        this.visual.outputHistory.push(Number.isFinite(outputDb) ? outputDb : -60);
        this.visual.grHistory.push(Number.isFinite(reductionDb) ? Math.max(0, reductionDb) : 0);
        while (this.visual.inputHistory.length > this.visual.maxHistoryLength) {
            this.visual.inputHistory.shift();
            this.visual.outputHistory.shift();
            this.visual.grHistory.shift();
        }
        this.scheduleVisualizerUpdate();
    }

    scheduleVisualizerUpdate() {
        if (this.visual.pendingFrame) return;
        const requestFrame = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (callback) => setTimeout(callback, 16);
        this.visual.pendingFrame = requestFrame(() => {
            this.visual.pendingFrame = 0;
            this.updateLimiterVisualizers();
        });
    }

    prepareVisualCanvas(canvas) {
        if (!canvas || !canvas.isConnected) return null;
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 20) return null;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const pixelWidth = Math.max(240, Math.round(rect.width * dpr));
        const pixelHeight = Math.max(120, Math.round(rect.height * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        const context = canvas.getContext('2d');
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, rect.width, rect.height);
        return { context, width: rect.width, height: rect.height };
    }

    drawLimiterGrid(context, width, height, pad = { left: 30, right: 10, top: 12, bottom: 22 }) {
        const graphWidth = width - pad.left - pad.right;
        const graphHeight = height - pad.top - pad.bottom;
        context.lineWidth = 1;
        context.strokeStyle = 'rgba(160,200,120,.11)';
        for (let index = 0; index <= 6; index++) {
            const x = pad.left + (graphWidth * index / 6);
            context.beginPath(); context.moveTo(x, pad.top); context.lineTo(x, pad.top + graphHeight); context.stroke();
        }
        for (let index = 0; index <= 4; index++) {
            const y = pad.top + (graphHeight * index / 4);
            context.beginPath(); context.moveTo(pad.left, y); context.lineTo(pad.left + graphWidth, y); context.stroke();
        }
        return { graphWidth, graphHeight };
    }

    updateLimiterVisualizers() {
        this.drawGainReductionHistory();
        this.drawTransferCurve();
        this.drawPeakTrace();
        const ceiling = this.getCeilingDb();
        const currentOutput = this.visual.outputHistory.at(-1);
        const truePeak = document.getElementById('limiter-true-peak');
        const ceilingNow = document.getElementById('limiter-ceiling-now');
        if (truePeak) truePeak.innerText = Number.isFinite(currentOutput) ? `${currentOutput.toFixed(1)} dBTP` : '-∞ dBTP';
        if (ceilingNow) ceilingNow.innerText = `${ceiling.toFixed(1)} dBTP`;
    }

    drawGainReductionHistory() {
        const prepared = this.prepareVisualCanvas(this.visual.grCanvas || document.getElementById('limiter-gr-history-canvas'));
        if (!prepared) return;
        const { context, width, height } = prepared;
        const pad = { left: 30, right: 10, top: 12, bottom: 22 };
        const { graphWidth, graphHeight } = this.drawLimiterGrid(context, width, height, pad);
        const data = this.visual.grHistory;
        const yOf = (value) => pad.top + Math.min(1, Math.max(0, value) / 24) * graphHeight;
        context.fillStyle = '#94a3b8'; context.font = '9px monospace';
        [0, 6, 12, 18, 24].forEach((db) => context.fillText(db ? `-${db}` : '0', 4, yOf(db) + 3));
        if (data.length > 1) {
            const gradient = context.createLinearGradient(0, pad.top, 0, pad.top + graphHeight);
            gradient.addColorStop(0, 'rgba(163,230,53,.55)');
            gradient.addColorStop(.55, 'rgba(250,204,21,.38)');
            gradient.addColorStop(1, 'rgba(239,68,68,.25)');
            context.beginPath(); context.moveTo(pad.left, pad.top);
            data.forEach((value, index) => context.lineTo(pad.left + index / (data.length - 1) * graphWidth, yOf(value)));
            context.lineTo(pad.left + graphWidth, pad.top); context.closePath(); context.fillStyle = gradient; context.fill();
            context.beginPath();
            data.forEach((value, index) => {
                const x = pad.left + index / (data.length - 1) * graphWidth;
                const y = yOf(value);
                if (!index) context.moveTo(x, y); else context.lineTo(x, y);
            });
            context.strokeStyle = '#a3e635'; context.lineWidth = 1.8; context.stroke();
        }
        const current = data.at(-1) || 0;
        const label = document.getElementById('limiter-gr-now');
        if (label) label.innerText = `${current.toFixed(1)} dB`;
    }

    drawTransferCurve() {
        const prepared = this.prepareVisualCanvas(this.visual.transferCanvas || document.getElementById('limiter-transfer-canvas'));
        if (!prepared) return;
        const { context, width, height } = prepared;
        const pad = { left: 32, right: 10, top: 12, bottom: 22 };
        const { graphWidth, graphHeight } = this.drawLimiterGrid(context, width, height, pad);
        const minDb = -36;
        const maxDb = 6;
        const threshold = Number(this.audioState.limiter.threshold);
        const outputGain = Number(this.audioState.limiter.outputGain);
        const ceiling = this.getCeilingDb();
        const xOf = (db) => pad.left + (db - minDb) / (maxDb - minDb) * graphWidth;
        const yOf = (db) => pad.top + graphHeight - (db - minDb) / (maxDb - minDb) * graphHeight;
        context.setLineDash([4, 4]);
        context.strokeStyle = 'rgba(250,204,21,.75)'; context.beginPath(); context.moveTo(pad.left, yOf(ceiling)); context.lineTo(pad.left + graphWidth, yOf(ceiling)); context.stroke();
        context.strokeStyle = 'rgba(163,230,53,.6)'; context.beginPath(); context.moveTo(xOf(threshold), pad.top); context.lineTo(xOf(threshold), pad.top + graphHeight); context.stroke(); context.setLineDash([]);
        const points = [];
        for (let index = 0; index <= 160; index++) {
            const input = minDb + index / 160 * (maxDb - minDb);
            const hardOutput = input <= threshold ? input + outputGain : ceiling;
            const kneeStart = threshold - 2;
            const mix = Math.max(0, Math.min(1, (input - kneeStart) / 4));
            const smooth = mix * mix * (3 - 2 * mix);
            const output = input < kneeStart ? input + outputGain : Math.min(ceiling, (input + outputGain) * (1 - smooth) + ceiling * smooth);
            points.push({ x: xOf(input), y: yOf(Number.isFinite(output) ? output : hardOutput) });
        }
        context.beginPath(); context.moveTo(points[0].x, pad.top + graphHeight); points.forEach((point) => context.lineTo(point.x, point.y)); context.lineTo(points.at(-1).x, pad.top + graphHeight); context.closePath();
        const fill = context.createLinearGradient(0, pad.top, 0, pad.top + graphHeight); fill.addColorStop(0, 'rgba(163,230,53,.38)'); fill.addColorStop(1, 'rgba(163,230,53,.03)'); context.fillStyle = fill; context.fill();
        context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.strokeStyle = '#a3e635'; context.lineWidth = 2; context.stroke();
        const latestInput = this.visual.inputHistory.at(-1);
        const latestOutput = this.visual.outputHistory.at(-1);
        if (Number.isFinite(latestInput) && Number.isFinite(latestOutput)) {
            context.beginPath(); context.arc(xOf(Math.max(minDb, Math.min(maxDb, latestInput))), yOf(Math.max(minDb, Math.min(maxDb, latestOutput))), 4, 0, Math.PI * 2); context.fillStyle = '#d9f99d'; context.fill();
        }
        context.fillStyle = '#94a3b8'; context.font = '9px monospace'; context.fillText('INPUT dB', width / 2 - 20, height - 5);
        const info = document.getElementById('limiter-curve-info');
        if (info) info.innerText = `TH ${threshold.toFixed(1)} / CEIL ${ceiling.toFixed(1)} dB`;
    }

    drawPeakTrace() {
        const prepared = this.prepareVisualCanvas(this.visual.peakCanvas || document.getElementById('limiter-peak-trace-canvas'));
        if (!prepared) return;
        const { context, width, height } = prepared;
        const pad = { left: 30, right: 10, top: 12, bottom: 22 };
        const { graphWidth, graphHeight } = this.drawLimiterGrid(context, width, height, pad);
        const minDb = -36;
        const maxDb = 3;
        const yOf = (db) => pad.top + graphHeight - (Math.max(minDb, Math.min(maxDb, db)) - minDb) / (maxDb - minDb) * graphHeight;
        const ceiling = this.getCeilingDb();
        context.setLineDash([4, 4]); context.strokeStyle = 'rgba(250,204,21,.75)'; context.beginPath(); context.moveTo(pad.left, yOf(ceiling)); context.lineTo(pad.left + graphWidth, yOf(ceiling)); context.stroke(); context.setLineDash([]);
        const drawSeries = (data, color, lineWidth) => {
            if (data.length < 2) return;
            context.beginPath(); data.forEach((value, index) => {
                const x = pad.left + index / (data.length - 1) * graphWidth;
                const y = yOf(value);
                if (!index) context.moveTo(x, y); else context.lineTo(x, y);
            }); context.strokeStyle = color; context.lineWidth = lineWidth; context.stroke();
        };
        drawSeries(this.visual.inputHistory, 'rgba(251,191,36,.72)', 1.2);
        drawSeries(this.visual.outputHistory, '#a3e635', 1.9);
        context.fillStyle = '#94a3b8'; context.font = '9px monospace';
        [0, -12, -24, -36].forEach((db) => context.fillText(String(db), 3, yOf(db) + 3));
        const current = this.visual.outputHistory.at(-1);
        const label = document.getElementById('limiter-peak-now');
        if (label) label.innerText = Number.isFinite(current) ? `${current.toFixed(1)} dB` : '-∞ dB';
    }

    bindLiveControls(context, getPlayStateCallback, getBypassStateCallback, updateRangeFillCallback) {
        const limiterToggle = document.getElementById('limiter-toggle');
        if (limiterToggle) {
            limiterToggle.onclick = () => {
                this.audioState.limiter.enabled = !this.audioState.limiter.enabled;
                this.updateUI(updateRangeFillCallback);
                if (getPlayStateCallback()) this.applySettings(context, getBypassStateCallback);
            };
        }

        const limiterControls = [
            { id: 'limiter-threshold', key: 'threshold' },
            { id: 'limiter-release', key: 'release' },
            { id: 'limiter-output', key: 'outputGain' }
        ];

        limiterControls.forEach(({ id, key }) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.oninput = (e) => {
                this.audioState.limiter[key] = parseFloat(e.target.value);
                this.updateUI(updateRangeFillCallback);
                if (getPlayStateCallback()) this.applySettings(context, getBypassStateCallback);
            };
        });

        document.querySelectorAll('.limiter-step-btn').forEach((button) => {
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

    getSettings() {
        return { ...this.audioState.limiter };
    }

    setSettings(settings) {
        if (settings) {
            this.audioState.limiter = { ...settings };
        }
    }

    syncInputs() {
        const lim = this.audioState.limiter;
        const thresh = document.getElementById('limiter-threshold');
        const release = document.getElementById('limiter-release');
        const output = document.getElementById('limiter-output');
        if (thresh) thresh.value = lim.threshold;
        if (release) release.value = lim.release;
        if (output) output.value = lim.outputGain;
    }
}
