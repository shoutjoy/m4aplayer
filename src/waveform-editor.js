(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const invoke = window.__TAURI__?.core?.invoke;
  const audio = $("audio");
  const waveCanvas = $("stereoWave");
  const formantCanvas = $("formantCanvas");
  if (!audio || !waveCanvas || !formantCanvas || !invoke) return;

  const ui = {
    path: $("infoPath"),
    status: $("status"),
    empty: $("waveEmpty"),
    zoom: $("waveZoom"),
    zoomOut: $("waveZoomOut"),
    zoomReset: $("waveZoomReset"),
    zoomIn: $("waveZoomIn"),
    readout: $("formantReadout"),
    analysisState: $("analysisState"),
    exportAnalysis: $("exportAnalysis"),
    fadeInEnabled: $("fadeInEnabled"),
    fadeInDuration: $("fadeInDuration"),
    fadeOutEnabled: $("fadeOutEnabled"),
    fadeOutDuration: $("fadeOutDuration"),
    preview: $("fadePreview"),
    saveNew: $("fadeSaveNew"),
    overwrite: $("fadeOverwrite"),
    editRange: $("editRange"),
    editReset: $("editReset"),
    trimShadeLeft: $("trimShadeLeft"),
    trimShadeRight: $("trimShadeRight"),
    trimStartHandle: $("trimStartHandle"),
    trimEndHandle: $("trimEndHandle"),
    trimStartLabel: $("trimStartLabel"),
    trimEndLabel: $("trimEndLabel"),
    fadeInHandle: $("fadeInHandle"),
    fadeOutHandle: $("fadeOutHandle"),
    fadeInLabel: $("fadeInLabel"),
    fadeOutLabel: $("fadeOutLabel"),
    volume: $("vol")
  };

  const state = {
    token: 0,
    buffer: null,
    peaks: [],
    formants: [],
    zoom: 1,
    offset: 0,
    preview: false,
    busy: false,
    waveFrame: 0,
    trimStart: 0,
    trimEnd: 0,
    dragging: null
  };

  const message = (text) => { if (ui.status) ui.status.textContent = text; };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fadeInSeconds = () => ui.fadeInEnabled.checked ? clamp(Number(ui.fadeInDuration.value) || 1, 0.1, 60) : 0;
  const fadeOutSeconds = () => ui.fadeOutEnabled.checked ? clamp(Number(ui.fadeOutDuration.value) || 1, 0.1, 60) : 0;
  const clipDuration = () => Math.max(0, state.trimEnd - state.trimStart);
  const formatEditTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    return `${String(minutes).padStart(2, "0")}:${(safe % 60).toFixed(1).padStart(4, "0")}`;
  };
  const normalizedFadeIn = () => Math.min(fadeInSeconds(), clipDuration());
  const normalizedFadeOut = () => Math.min(fadeOutSeconds(), clipDuration());
  const visibleRange = () => {
    const span = 1 / state.zoom;
    const start = state.offset * (1 - span);
    return { start, end: start + span, span };
  };

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width: rect.width, height: rect.height };
  }

  function buildPeaks(buffer) {
    const bucketCount = Math.min(12000, Math.max(2500, Math.ceil(buffer.duration * 45)));
    const channels = [];
    for (let channelIndex = 0; channelIndex < Math.min(2, buffer.numberOfChannels); channelIndex++) {
      const samples = buffer.getChannelData(channelIndex);
      const min = new Float32Array(bucketCount);
      const max = new Float32Array(bucketCount);
      for (let bucket = 0; bucket < bucketCount; bucket++) {
        const from = Math.floor(bucket * samples.length / bucketCount);
        const to = Math.max(from + 1, Math.floor((bucket + 1) * samples.length / bucketCount));
        let low = 1;
        let high = -1;
        for (let index = from; index < to; index++) {
          const sample = samples[index] || 0;
          if (sample < low) low = sample;
          if (sample > high) high = sample;
        }
        min[bucket] = low;
        max[bucket] = high;
      }
      channels.push({ min, max });
    }
    if (channels.length === 1) channels.push(channels[0]);
    return channels;
  }

  async function analyseAcoustics(buffer, token) {
    const frames = Math.max(1, Math.ceil(buffer.duration * 2));
    const sampleRate = buffer.sampleRate;
    const windowSize = 2048;
    const mono = buffer.getChannelData(0);
    const second = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const frequencies = [];
    for (let frequency = 150; frequency <= Math.min(5000, sampleRate / 2 - 100); frequency += 50) frequencies.push(frequency);
    const result = [];
    const started = performance.now();

    for (let frame = 0; frame < frames; frame++) {
      if (token !== state.token) return [];
      if (frame % 4 === 0) {
        const percent = frame / frames * 100;
        ui.analysisState.textContent = `음향 지표 계산 ${Math.floor(percent)}% · ${frame}/${frames} 구간`;
        window.JJaIMsaeAnalysisView?.setProgress({stage:'acoustics',message:'Pitch · 포먼트 · 음성 지표 계산 중',percent,
          detail:`${frame}/${frames} 구간 · ${Math.min(frame*.5,buffer.duration).toFixed(1)} / ${buffer.duration.toFixed(1)}초 처리 · F1/F2/F3 · Jitter · Shimmer · NHR · 자기상관 · RMS`,elapsedMs:performance.now()-started});
        await new Promise(resolve=>setTimeout(resolve,0));
        if (token !== state.token) return [];
      }
      const position = frame * 0.5 / buffer.duration;
      const center = Math.floor(position * (mono.length - 1));
      const metricStart = Math.max(0, center - Math.floor(sampleRate * .06));
      const metricEnd = Math.min(mono.length, metricStart + Math.floor(sampleRate * .12));
      const rawMetric = new Float32Array(metricEnd - metricStart);
      for (let j = 0; j < rawMetric.length; j++) rawMetric[j] = second ? (mono[metricStart+j] + second[metricStart+j])*.5 : mono[metricStart+j];
      const metrics = window.JJaIMsaeAcoustics.metrics(rawMetric, sampleRate);
      // Stereo RMS over the complete time bin, without phase cancellation.
      let rmsEnergy = 0, rmsCount = 0;
      for (let j = center; j < Math.min(mono.length, center + sampleRate*.5); j++) {
        rmsEnergy += mono[j]*mono[j] + (second ? second[j]*second[j] : 0);
        rmsCount += second ? 2 : 1;
      }
      metrics.db = rmsEnergy > 0 ? 10*Math.log10(rmsEnergy/rmsCount) : null;
      const from = clamp(center - Math.floor(windowSize / 2), 1, Math.max(1, mono.length - windowSize - 1));
      const values = new Float32Array(windowSize);
      const pitchValues = new Float32Array(windowSize);
      let energy = 0;
      let previous = second ? (mono[from - 1] + second[from - 1]) * 0.5 : mono[from - 1];
      for (let index = 0; index < windowSize; index++) {
        const sourceIndex = Math.min(mono.length - 1, from + index);
        const raw = second ? (mono[sourceIndex] + second[sourceIndex]) * 0.5 : mono[sourceIndex];
        const emphasized = raw - 0.97 * previous;
        previous = raw;
        const windowGain = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (windowSize - 1));
        const sample = emphasized * windowGain;
        values[index] = sample;
        pitchValues[index] = raw * windowGain;
        energy += sample * sample;
      }
      if (Math.sqrt(energy / windowSize) < 0.003) {
        result.push({ ...metrics, position, pitch: null, confidence: 0, f1: null, f2: null, f3: null });
        if (frame % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        continue;
      }

      // Normalized autocorrelation. Restricting the lag range to 55–1000 Hz
      // avoids most sub-bass/noise detections while covering sung voices.
      const minLag = Math.max(2, Math.floor(sampleRate / 1000));
      const maxLag = Math.min(windowSize - 2, Math.ceil(sampleRate / 55));
      const correlationStride = 4;
      let bestLag = 0;
      let bestCorrelation = 0;
      for (let lag = minLag; lag <= maxLag; lag += correlationStride) {
        let cross = 0;
        let energyA = 0;
        let energyB = 0;
        for (let index = 0; index < windowSize - lag; index += correlationStride) {
          const a = pitchValues[index];
          const b = pitchValues[index + lag];
          cross += a * b;
          energyA += a * a;
          energyB += b * b;
        }
        const correlation = cross / Math.sqrt(Math.max(1e-12, energyA * energyB));
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestLag = lag;
        }
      }
      for (let lag = Math.max(minLag, bestLag - correlationStride + 1); lag <= Math.min(maxLag, bestLag + correlationStride - 1); lag++) {
        let cross = 0;
        let energyA = 0;
        let energyB = 0;
        for (let index = 0; index < windowSize - lag; index += correlationStride) {
          const a = pitchValues[index];
          const b = pitchValues[index + lag];
          cross += a * b;
          energyA += a * a;
          energyB += b * b;
        }
        const correlation = cross / Math.sqrt(Math.max(1e-12, energyA * energyB));
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestLag = lag;
        }
      }
      let pitch = bestCorrelation >= 0.55 && bestLag ? sampleRate / bestLag : null;
      if (pitch) pitch = Math.round(pitch * 10) / 10;

      const power = frequencies.map((frequency) => {
        const omega = 2 * Math.PI * frequency / sampleRate;
        let real = 0;
        let imaginary = 0;
        for (let index = 0; index < windowSize; index++) {
          real += values[index] * Math.cos(omega * index);
          imaginary -= values[index] * Math.sin(omega * index);
        }
        return Math.log10(1e-9 + real * real + imaginary * imaginary);
      });
      const smooth = power.map((value, index) => {
        let sum = 0;
        let count = 0;
        for (let around = Math.max(0, index - 2); around <= Math.min(power.length - 1, index + 2); around++) {
          sum += power[around];
          count++;
        }
        return sum / count;
      });
      const peaks = [];
      for (let index = 1; index < smooth.length - 1; index++) {
        if (smooth[index] > smooth[index - 1] && smooth[index] >= smooth[index + 1]) {
          peaks.push({ frequency: frequencies[index], strength: smooth[index] });
        }
      }
      const strongest = (minimum, maximum) => {
        const localPeak = peaks
          .filter((peak) => peak.frequency >= minimum && peak.frequency <= maximum)
          .sort((a, b) => b.strength - a.strength)[0];
        if (localPeak) return localPeak.frequency;
        let bestIndex = -1;
        for (let index = 0; index < frequencies.length; index++) {
          if (frequencies[index] < minimum || frequencies[index] > maximum) continue;
          if (bestIndex < 0 || smooth[index] > smooth[bestIndex]) bestIndex = index;
        }
        return bestIndex >= 0 ? frequencies[bestIndex] : null;
      };
      const f1 = strongest(200, 1100);
      const f2 = strongest(Math.max(700, (f1 || 450) + 250), 3500);
      const f3 = strongest(Math.max(1800, (f2 || 1600) + 250), 5000);
      result.push({ ...metrics, position, pitch, confidence: Math.round(bestCorrelation * 1000) / 1000, f1, f2, f3 });
      if (frame % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return result;
  }

  async function loadWaveform() {
    const path = ui.path?.textContent?.trim();
    if (!path || path === "-") return;
    const token = ++state.token;
    window.JJaIMsaeAnalysisView?.reset();
    state.buffer = null;
    state.peaks = [];
    state.formants = [];
    state.zoom = 1;
    state.offset = 0;
    ui.empty.classList.remove("hidden");
    ui.empty.textContent = "파형을 불러오는 중…";
    ui.analysisState.textContent = "오디오 디코딩 중";
    ui.exportAnalysis.disabled = true;
    window.JJaIMsaeAnalysisView?.setProgress({stage:'loading',message:'오디오 파일 읽는 중',detail:path});
    message("오디오 파형을 분석하는 중…");
    drawAll();
    try {
      const bytes = await invoke("read_binary", { path });
      if (token !== state.token) return;
      const encoded = Uint8Array.from(bytes).buffer;
      window.JJaIMsaeAnalysisView?.setProgress({stage:'decode',message:'오디오 디코딩 중',detail:'파형과 분석에 사용할 오디오 샘플을 준비합니다.'});
      await new Promise(resolve=>setTimeout(resolve,0));
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await context.decodeAudioData(encoded);
      await context.close();
      if (token !== state.token) return;
      state.buffer = buffer;
      window.JJaIMsaeAnalysisView?.setProgress({stage:'bpm',message:'BPM · 파형 계산 중',detail:`${buffer.duration.toFixed(1)}초 오디오의 박자와 파형을 추출합니다.`});
      await new Promise(resolve=>setTimeout(resolve,0));
      if (token !== state.token) return;
      const tempo = window.JJaIMsaeAcoustics.bpm(buffer);
      document.getElementById('tempoBpm').textContent = tempo ? `BPM ≈ ${tempo.toFixed(1)}` : 'BPM 검출 불가';
      state.peaks = buildPeaks(buffer);
      state.trimStart = 0;
      state.trimEnd = buffer.duration;
      state.preview = false;
      ui.preview.classList.remove("active");
      ui.preview.textContent = "▶ 미리듣기";
      applyPreview();
      ui.empty.classList.add("hidden");
      drawAll();
      message("파형 로드 완료 · 피치/포먼트 분석 중…");
      ui.analysisState.textContent = "Pitch · F1/F2/F3 분석 중";
      const analysed = await analyseAcoustics(buffer, token);
      if (token !== state.token) return;
      state.formants = analysed;
      ui.analysisState.textContent = `${state.formants.length} 프레임 분석 완료`;
      ui.exportAnalysis.disabled = !state.formants.length;
      window.JJaIMsaeAnalysisView.setData(state.formants.map(point => ({...point, time: point.position * buffer.duration})), path);
      drawAll();
      message(`스테레오 파형과 Pitch/F1/F2/F3 분석 완료 · ${buffer.numberOfChannels}채널`);
    } catch (error) {
      if (token !== state.token) return;
      ui.empty.classList.remove("hidden");
      ui.empty.textContent = "파형을 불러오지 못했습니다.";
      window.JJaIMsaeAnalysisView?.setProgress({stage:'error',message:'분석 실패',detail:String(error)});
      ui.analysisState.textContent = "분석 실패";
      ui.exportAnalysis.disabled = true;
      message("파형 로드 실패: " + String(error));
      drawAll();
    }
  }

  function drawWaveform() {
    const { context, width, height } = fitCanvas(waveCanvas);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#050a11";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#162538";
    context.lineWidth = 1;
    for (let channel = 0; channel < 2; channel++) {
      const middle = height * (channel * 0.5 + 0.25);
      context.beginPath();
      context.moveTo(0, middle + 0.5);
      context.lineTo(width, middle + 0.5);
      context.stroke();
    }
    if (!state.peaks.length) return;
    const { start, end } = visibleRange();
    const colors = ["#24b7ff", "#7d7cff"];
    state.peaks.slice(0, 2).forEach((channel, channelIndex) => {
      const middle = height * (channelIndex * 0.5 + 0.25);
      const amplitude = height * 0.215;
      context.strokeStyle = colors[channelIndex];
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x < width; x++) {
        const position = start + x / Math.max(1, width - 1) * (end - start);
        const index = clamp(Math.floor(position * channel.min.length), 0, channel.min.length - 1);
        context.moveTo(x + 0.5, middle + channel.min[index] * amplitude);
        context.lineTo(x + 0.5, middle + channel.max[index] * amplitude);
      }
      context.stroke();
    });

    const duration = state.buffer?.duration || 0;
    const paintFade = (seconds, fromStart) => {
      if (!seconds || !duration) return;
      const clipStart = state.trimStart / duration;
      const clipEnd = state.trimEnd / duration;
      const edge = fromStart ? (state.trimStart + seconds) / duration : (state.trimEnd - seconds) / duration;
      const leftPosition = fromStart ? clipStart : edge;
      const rightPosition = fromStart ? edge : clipEnd;
      const left = (leftPosition - start) / (end - start) * width;
      const right = (rightPosition - start) / (end - start) * width;
      context.save();
      context.fillStyle = fromStart ? "rgba(45,156,255,.13)" : "rgba(255,91,116,.13)";
      context.fillRect(clamp(left, 0, width), 0, clamp(right, 0, width) - clamp(left, 0, width), height);
      context.strokeStyle = fromStart ? "#2d9cff" : "#ff5b74";
      context.setLineDash([5, 4]);
      const edgeX = (edge - start) / (end - start) * width;
      if (edgeX >= 0 && edgeX <= width) {
        context.beginPath();
        context.moveTo(edgeX, 0);
        context.lineTo(edgeX, height);
        context.stroke();
      }
      const clipEdgeX = ((fromStart ? clipStart : clipEnd) - start) / (end - start) * width;
      const bottom = height - 7;
      const top = 7;
      context.setLineDash([]);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(fromStart ? clipEdgeX : edgeX, bottom);
      context.lineTo(fromStart ? edgeX : clipEdgeX, top);
      context.stroke();
      context.restore();
    };
    paintFade(normalizedFadeIn(), true);
    paintFade(normalizedFadeOut(), false);

    if (audio.duration) {
      const progress = audio.currentTime / audio.duration;
      if (progress >= start && progress <= end) {
        const x = (progress - start) / (end - start) * width;
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
    }
  }

  function drawFormants() {
    const { context, width, height } = fitCanvas(formantCanvas);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#08101a";
    context.fillRect(0, 0, width, height);
    const { start, end } = visibleRange();
    context.font = "10px ui-monospace, monospace";
    context.textBaseline = "top";
    [0, 1000, 2000, 3000, 4000, 5000].forEach((frequency) => {
      const y = height - frequency / 5000 * (height - 12) - 1;
      context.strokeStyle = frequency ? "#17283a" : "#38506a";
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      context.fillStyle = "#71859c";
      context.fillText(frequency ? `${frequency / 1000}k` : "0 Hz", 5, Math.max(1, y - 11));
    });
    const drawSeries = (key, color) => {
      context.fillStyle = color;
      for (const point of state.formants) {
        if (!point[key] || point.position < start || point.position > end) continue;
        const x = (point.position - start) / (end - start) * width;
        const y = height - point[key] / 5000 * (height - 12);
        context.beginPath();
        context.arc(x, y, 2.25, 0, Math.PI * 2);
        context.fill();
      }
    };
    drawSeries("f1", "#ff4d5e");
    drawSeries("f2", "#ffad43");
    drawSeries("f3", "#b678ff");
    context.strokeStyle = "#62e6c5";
    context.lineWidth = 1.4;
    context.beginPath();
    let pitchStarted = false;
    for (const point of state.formants) {
      if (!point.pitch || point.position < start || point.position > end) { pitchStarted = false; continue; }
      const x = (point.position - start) / (end - start) * width;
      const pitchPosition = clamp((point.pitch - 50) / 950, 0, 1);
      const y = height - pitchPosition * (height - 12);
      if (pitchStarted) context.lineTo(x, y); else context.moveTo(x, y);
      pitchStarted = true;
    }
    context.stroke();
    context.fillStyle = "#62e6c5";
    context.textAlign = "right";
    context.fillText("Pitch 50–1000 Hz", width - 6, 4);
    context.textAlign = "left";
    updateFormantReadout();
  }

  function nearestFormant(position) {
    if (!state.formants.length) return null;
    return state.formants.reduce((best, point) => Math.abs(point.position - position) < Math.abs(best.position - position) ? point : best);
  }

  function updateFormantReadout(position = audio.duration ? audio.currentTime / audio.duration : 0) {
    const point = nearestFormant(position);
    ui.readout.textContent = point ? `Pitch ${point.pitch ?? "--"} Hz  ·  F1 ${point.f1 ?? "--"} Hz  ·  F2 ${point.f2 ?? "--"} Hz  ·  F3 ${point.f3 ?? "--"} Hz` : "Pitch -- Hz  ·  F1 -- Hz  ·  F2 -- Hz  ·  F3 -- Hz";
  }

  const pitchNote = (frequency) => {
    if (!frequency) return "";
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return `${names[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  };

  async function exportAnalysis() {
    if (!state.buffer || !state.formants.length) return message("저장할 분석 데이터가 없습니다.");
    await window.JJaIMsaeAnalysisView.save();
  }

  async function convertWithProfile(format, profile, label) {
    const path = ui.path?.textContent?.trim();
    if (!path || path === "-") return message("먼저 오디오를 선택하세요.");
    message(`${label} 변환 중…`);
    try {
      const result = await invoke("convert_audio", { path, format, profile });
      window.dispatchEvent(new CustomEvent("jjaimsae-converted-added", { detail: { path: result } }));
      message(`변환 완료: ${result}`);
    } catch (error) {
      message("변환 실패: " + String(error));
    }
  }

  function readFormantAt(event) {
    const rect = formantCanvas.getBoundingClientRect();
    const { start, span } = visibleRange();
    updateFormantReadout(start + clamp((event.clientX - rect.left) / rect.width, 0, 1) * span);
  }

  function updateEditorUi() {
    const duration = state.buffer?.duration || 0;
    const { start, end } = visibleRange();
    const toPercent = (seconds) => duration ? ((seconds / duration - start) / (end - start)) * 100 : 0;
    const place = (element, seconds) => {
      const percent = toPercent(seconds);
      element.hidden = !duration || percent < 0 || percent > 100;
      element.style.left = `${clamp(percent, 0, 100)}%`;
    };
    const startPercent = clamp(toPercent(state.trimStart), 0, 100);
    const endPercent = clamp(toPercent(state.trimEnd), 0, 100);
    ui.trimShadeLeft.style.width = `${startPercent}%`;
    ui.trimShadeRight.style.width = `${100 - endPercent}%`;
    ui.trimShadeLeft.hidden = !duration || state.trimStart <= start * duration;
    ui.trimShadeRight.hidden = !duration || state.trimEnd >= end * duration;
    place(ui.trimStartHandle, state.trimStart);
    place(ui.trimEndHandle, state.trimEnd);
    place(ui.fadeInHandle, state.trimStart + normalizedFadeIn());
    place(ui.fadeOutHandle, state.trimEnd - normalizedFadeOut());
    ui.trimStartLabel.textContent = formatEditTime(state.trimStart);
    ui.trimEndLabel.textContent = formatEditTime(state.trimEnd);
    ui.fadeInLabel.textContent = `${normalizedFadeIn().toFixed(1)}s`;
    ui.fadeOutLabel.textContent = `${normalizedFadeOut().toFixed(1)}s`;
    ui.editRange.textContent = duration
      ? `편집 구간 ${formatEditTime(state.trimStart)} → ${formatEditTime(state.trimEnd)} · ${formatEditTime(clipDuration())}`
      : "편집 구간 --:--.- → --:--.-";
    const maximumFade = Math.max(0.1, Math.min(60, clipDuration()));
    ui.fadeInDuration.max = ui.fadeOutDuration.max = maximumFade.toFixed(1);
  }

  function drawAll() {
    drawWaveform();
    drawFormants();
    updateEditorUi();
    ui.zoom.textContent = `Zoom ${state.zoom.toFixed(1)}×`;
    ui.zoomOut.disabled = state.zoom <= 1;
  }

  function keepWaveformVisible() {
    if (audio.paused || audio.ended) {
      state.waveFrame = 0;
      return;
    }
    // The legacy FFT loop resizes (and therefore clears) the waveform canvas
    // on every animation frame. Run after that loop and restore the waveform.
    if ($("waveform")?.classList.contains("active")) drawWaveform();
    state.waveFrame = requestAnimationFrame(keepWaveformVisible);
  }

  function startWaveformRenderLoop() {
    if (state.waveFrame) cancelAnimationFrame(state.waveFrame);
    state.waveFrame = requestAnimationFrame(keepWaveformVisible);
  }

  function changeZoom(factor) {
    state.zoom = clamp(state.zoom * factor, 1, 50);
    if (state.zoom === 1) state.offset = 0;
    drawAll();
  }

  function seekAt(event) {
    if (!audio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const { start, span } = visibleRange();
    const seconds = clamp(start + (event.clientX - rect.left) / rect.width * span, 0, 1) * audio.duration;
    audio.currentTime = clamp(seconds, state.trimStart, state.trimEnd);
    drawAll();
  }

  function previewGain() {
    if (!state.preview || !audio.duration) return 1;
    const fadeIn = normalizedFadeIn();
    const fadeOut = normalizedFadeOut();
    let gain = 1;
    if (fadeIn && audio.currentTime < state.trimStart + fadeIn) gain *= (audio.currentTime - state.trimStart) / fadeIn;
    if (fadeOut && audio.currentTime > state.trimEnd - fadeOut) gain *= (state.trimEnd - audio.currentTime) / fadeOut;
    return clamp(gain, 0, 1);
  }

  function applyPreview() {
    const baseVolume = Number(ui.volume?.value ?? 0.9);
    audio.volume = clamp(baseVolume * previewGain(), 0, 1);
  }

  function togglePreview() {
    if (!state.buffer) return message("먼저 오디오를 선택하세요.");
    setPreviewEnabled(!state.preview);
    message(state.preview ? "트림 구간과 Fade 미리듣기를 켰습니다." : "편집 미리듣기를 껐습니다.");
  }

  async function saveFades(overwrite) {
    const path = ui.path?.textContent?.trim();
    if (!path || path === "-" || !state.buffer) return message("먼저 오디오를 선택하세요.");
    const fadeIn = normalizedFadeIn();
    const fadeOut = normalizedFadeOut();
    if (clipDuration() < 0.1) return message("편집 구간을 0.1초 이상으로 지정하세요.");
    if (overwrite && !window.confirm("트림과 페이드를 적용해 원본 파일을 교체할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    if (state.busy) return;
    state.busy = true;
    ui.saveNew.disabled = ui.overwrite.disabled = true;
    message(overwrite ? "원본 파일에 오디오 편집을 적용하는 중…" : "편집한 오디오를 새 파일로 저장하는 중…");
    try {
      const result = await invoke("apply_audio_edit", {
        path,
        trimStart: state.trimStart,
        trimEnd: state.trimEnd,
        fadeIn,
        fadeOut,
        overwrite
      });
      if (overwrite) {
        const time = audio.currentTime;
        audio.pause();
        audio.src = window.__TAURI__.core.convertFileSrc(result) + `?fade=${Date.now()}`;
        audio.load();
        audio.addEventListener("loadedmetadata", () => { audio.currentTime = Math.min(time, audio.duration || 0); }, { once: true });
      }
      if (!overwrite) window.dispatchEvent(new CustomEvent("jjaimsae-converted-added", { detail: { path: result } }));
      message(overwrite ? "원본 파일에 트림과 페이드를 적용했습니다." : `편집본 저장 및 재생목록 추가 완료: ${result}`);
    } catch (error) {
      message("오디오 편집 저장 실패: " + String(error));
    } finally {
      state.busy = false;
      ui.saveNew.disabled = ui.overwrite.disabled = false;
    }
  }

  function setPreviewEnabled(enabled) {
    state.preview = enabled;
    ui.preview.classList.toggle("active", enabled);
    ui.preview.textContent = enabled ? "■ 미리듣기 끄기" : "▶ 미리듣기";
    applyPreview();
  }

  function timeAtPointer(clientX) {
    const rect = waveCanvas.getBoundingClientRect();
    const { start, span } = visibleRange();
    if (!rect.width || !state.buffer) return 0;
    return clamp(start + (clientX - rect.left) / rect.width * span, 0, 1) * state.buffer.duration;
  }

  function updateFadeValue(which, seconds) {
    const input = which === "fadeIn" ? ui.fadeInDuration : ui.fadeOutDuration;
    const enabled = which === "fadeIn" ? ui.fadeInEnabled : ui.fadeOutEnabled;
    const value = clamp(seconds, 0, Math.min(60, clipDuration()));
    enabled.checked = value >= 0.05;
    input.value = Math.max(0.1, value).toFixed(1);
    if (enabled.checked) setPreviewEnabled(true);
  }

  function beginHandleDrag(mode, event) {
    if (event.button !== 0 || !state.buffer || state.busy) return;
    event.preventDefault();
    event.stopPropagation();
    state.dragging = { mode, pointerId: event.pointerId, element: event.currentTarget };
    event.currentTarget.classList.add("dragging");
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveHandle(event) {
    const drag = state.dragging;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const time = timeAtPointer(event.clientX);
    const minimum = 0.1;
    if (drag.mode === "trimStart") {
      state.trimStart = clamp(time, 0, state.trimEnd - minimum);
      if (audio.currentTime < state.trimStart) audio.currentTime = state.trimStart;
    } else if (drag.mode === "trimEnd") {
      state.trimEnd = clamp(time, state.trimStart + minimum, state.buffer.duration);
      if (audio.currentTime > state.trimEnd) audio.currentTime = state.trimEnd;
    } else if (drag.mode === "fadeIn") {
      updateFadeValue("fadeIn", time - state.trimStart);
    } else if (drag.mode === "fadeOut") {
      updateFadeValue("fadeOut", state.trimEnd - time);
    }
    if (fadeInSeconds() > clipDuration()) ui.fadeInDuration.value = clipDuration().toFixed(1);
    if (fadeOutSeconds() > clipDuration()) ui.fadeOutDuration.value = clipDuration().toFixed(1);
    applyPreview();
    drawAll();
  }

  function endHandleDrag(event) {
    const drag = state.dragging;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.element.classList.remove("dragging");
    drag.element.releasePointerCapture?.(event.pointerId);
    state.dragging = null;
    message(`편집 구간 ${formatEditTime(state.trimStart)} → ${formatEditTime(state.trimEnd)} · Ctrl+E로 현재 위치 분할`);
  }

  function resetEdit() {
    if (!state.buffer) return;
    state.trimStart = 0;
    state.trimEnd = state.buffer.duration;
    ui.fadeInEnabled.checked = false;
    ui.fadeOutEnabled.checked = false;
    ui.fadeInDuration.value = "1.0";
    ui.fadeOutDuration.value = "1.0";
    setPreviewEnabled(false);
    drawAll();
    message("트림과 페이드 편집을 초기화했습니다.");
  }

  function enforceEditPlayback() {
    if (!state.buffer || state.dragging) return;
    if (audio.currentTime < state.trimStart - 0.01) audio.currentTime = state.trimStart;
    if (!audio.paused && audio.currentTime >= state.trimEnd - 0.01) {
      audio.pause();
      audio.currentTime = state.trimEnd;
      message("편집 구간 끝에 도달했습니다.");
    }
  }

  async function splitAtPlayhead() {
    const path = ui.path?.textContent?.trim();
    if (!path || path === "-" || !state.buffer) return message("먼저 오디오를 선택하세요.");
    const cutAt = audio.currentTime;
    if (cutAt <= state.trimStart + 0.05 || cutAt >= state.trimEnd - 0.05) {
      return message("재생 헤드를 편집 구간 안쪽에 놓고 Ctrl+E를 누르세요.");
    }
    if (state.busy) return;
    state.busy = true;
    ui.saveNew.disabled = ui.overwrite.disabled = true;
    message(`${formatEditTime(cutAt)}에서 오디오를 자르는 중…`);
    try {
      const results = await invoke("split_audio_clip", {
        path,
        rangeStart: state.trimStart,
        cutAt,
        rangeEnd: state.trimEnd
      });
      window.dispatchEvent(new CustomEvent("jjaimsae-converted-added", { detail: { paths: results } }));
      message(`오디오 분할 완료 · ${results.length}개 파일을 재생목록에 추가했습니다.`);
    } catch (error) {
      message("오디오 분할 실패: " + String(error));
    } finally {
      state.busy = false;
      ui.saveNew.disabled = ui.overwrite.disabled = false;
    }
  }

  audio.addEventListener("loadedmetadata", loadWaveform);
  audio.addEventListener("play", () => {
    if (state.buffer && (audio.currentTime < state.trimStart || audio.currentTime >= state.trimEnd)) audio.currentTime = state.trimStart;
    applyPreview();
    startWaveformRenderLoop();
  });
  audio.addEventListener("timeupdate", () => { enforceEditPlayback(); applyPreview(); drawAll(); });
  audio.addEventListener("pause", () => {
    if (state.waveFrame) cancelAnimationFrame(state.waveFrame);
    state.waveFrame = 0;
    applyPreview();
    drawAll();
  });
  waveCanvas.addEventListener("click", seekAt);
  formantCanvas.addEventListener("click", seekAt);
  formantCanvas.addEventListener("mousemove", readFormantAt);
  formantCanvas.addEventListener("mouseleave", () => updateFormantReadout());
  waveCanvas.addEventListener("wheel", (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 1.25 : 0.8);
    } else if (event.shiftKey) {
      event.preventDefault();
      state.offset = clamp(state.offset + Math.sign(event.deltaY) * 0.06, 0, 1);
    }
    drawAll();
  }, { passive: false });
  ui.zoomOut.addEventListener("click", () => changeZoom(0.8));
  ui.zoomIn.addEventListener("click", () => changeZoom(1.25));
  ui.zoomReset.addEventListener("click", () => {
    state.zoom = 1;
    state.offset = 0;
    drawAll();
  });
  ui.preview.addEventListener("click", togglePreview);
  ui.saveNew.addEventListener("click", () => saveFades(false));
  ui.overwrite.addEventListener("click", () => saveFades(true));
  ui.editReset.addEventListener("click", resetEdit);
  [
    [ui.trimStartHandle, "trimStart"],
    [ui.trimEndHandle, "trimEnd"],
    [ui.fadeInHandle, "fadeIn"],
    [ui.fadeOutHandle, "fadeOut"]
  ].forEach(([element, mode]) => {
    element.addEventListener("pointerdown", (event) => beginHandleDrag(mode, event));
    element.addEventListener("pointermove", moveHandle);
    element.addEventListener("pointerup", endHandleDrag);
    element.addEventListener("pointercancel", endHandleDrag);
  });
  ui.exportAnalysis.addEventListener("click", exportAnalysis);
  $("toMp3").onclick = () => convertWithProfile("mp3", "mp3_hq", "MP3 320 kbps");
  $("toWav").onclick = () => convertWithProfile("wav", "wav24_48k", "WAV 24-bit / 48 kHz");
  $("toWav16").onclick = () => convertWithProfile("wav", "wav16_48k", "WAV 16-bit / 48 kHz");
  $("clear")?.addEventListener("click", () => {
    window.JJaIMsaeAnalysisView?.reset();
    document.getElementById("tempoBpm").textContent = "BPM —";
    state.token++;
    state.buffer = null;
    state.peaks = [];
    state.formants = [];
    state.preview = false;
    state.trimStart = 0;
    state.trimEnd = 0;
    ui.empty.classList.remove("hidden");
    ui.empty.textContent = "오디오를 선택하면 스테레오 파형을 그립니다.";
    ui.analysisState.textContent = "분석 대기";
    ui.exportAnalysis.disabled = true;
    applyPreview();
    drawAll();
  });
  [ui.fadeInEnabled, ui.fadeOutEnabled, ui.fadeInDuration, ui.fadeOutDuration].forEach((element) => element.addEventListener("change", () => {
    if (fadeInSeconds() > clipDuration()) ui.fadeInDuration.value = Math.max(0.1, clipDuration()).toFixed(1);
    if (fadeOutSeconds() > clipDuration()) ui.fadeOutDuration.value = Math.max(0.1, clipDuration()).toFixed(1);
    applyPreview();
    drawAll();
  }));
  window.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "e") return;
    const target = event.target;
    if (target?.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName)) return;
    if (!$("masteringPanel")?.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) splitAtPlayhead();
  }, true);
  new ResizeObserver(drawAll).observe(waveCanvas.parentElement);
  drawAll();
})();
