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
    fadeInEnabled: $("fadeInEnabled"),
    fadeInDuration: $("fadeInDuration"),
    fadeOutEnabled: $("fadeOutEnabled"),
    fadeOutDuration: $("fadeOutDuration"),
    preview: $("fadePreview"),
    saveNew: $("fadeSaveNew"),
    overwrite: $("fadeOverwrite"),
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
    waveFrame: 0
  };

  const message = (text) => { if (ui.status) ui.status.textContent = text; };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fadeInSeconds = () => ui.fadeInEnabled.checked ? clamp(Number(ui.fadeInDuration.value) || 1, 0.1, 60) : 0;
  const fadeOutSeconds = () => ui.fadeOutEnabled.checked ? clamp(Number(ui.fadeOutDuration.value) || 1, 0.1, 60) : 0;
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

  async function analyseFormants(buffer, token) {
    const frames = Math.min(220, Math.max(70, Math.ceil(buffer.duration * 4)));
    const sampleRate = buffer.sampleRate;
    const windowSize = 768;
    const mono = buffer.getChannelData(0);
    const second = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const frequencies = [];
    for (let frequency = 150; frequency <= 4000; frequency += 50) frequencies.push(frequency);
    const result = [];

    for (let frame = 0; frame < frames; frame++) {
      if (token !== state.token) return [];
      const position = frames === 1 ? 0 : frame / (frames - 1);
      const center = Math.floor(position * (mono.length - 1));
      const from = clamp(center - Math.floor(windowSize / 2), 1, Math.max(1, mono.length - windowSize - 1));
      const values = new Float32Array(windowSize);
      let energy = 0;
      let previous = second ? (mono[from - 1] + second[from - 1]) * 0.5 : mono[from - 1];
      for (let index = 0; index < windowSize; index++) {
        const sourceIndex = Math.min(mono.length - 1, from + index);
        const raw = second ? (mono[sourceIndex] + second[sourceIndex]) * 0.5 : mono[sourceIndex];
        const emphasized = raw - 0.97 * previous;
        previous = raw;
        const sample = emphasized * (0.5 - 0.5 * Math.cos(2 * Math.PI * index / (windowSize - 1)));
        values[index] = sample;
        energy += sample * sample;
      }
      if (Math.sqrt(energy / windowSize) < 0.003) {
        result.push({ position, f1: null, f2: null });
        continue;
      }

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
      result.push({ position, f1, f2 });
      if (frame % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return result;
  }

  async function loadWaveform() {
    const path = ui.path?.textContent?.trim();
    if (!path || path === "-") return;
    const token = ++state.token;
    state.buffer = null;
    state.peaks = [];
    state.formants = [];
    state.zoom = 1;
    state.offset = 0;
    ui.empty.classList.remove("hidden");
    ui.empty.textContent = "파형을 불러오는 중…";
    message("오디오 파형을 분석하는 중…");
    drawAll();
    try {
      const bytes = await invoke("read_binary", { path });
      if (token !== state.token) return;
      const encoded = Uint8Array.from(bytes).buffer;
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await context.decodeAudioData(encoded);
      await context.close();
      if (token !== state.token) return;
      state.buffer = buffer;
      state.peaks = buildPeaks(buffer);
      ui.empty.classList.add("hidden");
      drawAll();
      message("파형 로드 완료 · 포먼트 분석 중…");
      state.formants = await analyseFormants(buffer, token);
      if (token !== state.token) return;
      drawAll();
      message(`스테레오 파형과 F1/F2 분석 완료 · ${buffer.numberOfChannels}채널`);
    } catch (error) {
      if (token !== state.token) return;
      ui.empty.classList.remove("hidden");
      ui.empty.textContent = "파형을 불러오지 못했습니다.";
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
      const edge = fromStart ? seconds / duration : 1 - seconds / duration;
      const leftPosition = fromStart ? 0 : edge;
      const rightPosition = fromStart ? edge : 1;
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
      context.restore();
    };
    paintFade(fadeInSeconds(), true);
    paintFade(fadeOutSeconds(), false);

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
    [0, 1000, 2000, 3000, 4000].forEach((frequency) => {
      const y = height - frequency / 4000 * (height - 12) - 1;
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
        const y = height - point[key] / 4000 * (height - 12);
        context.beginPath();
        context.arc(x, y, 2.25, 0, Math.PI * 2);
        context.fill();
      }
    };
    drawSeries("f1", "#ff4d5e");
    drawSeries("f2", "#ffad43");
    updateFormantReadout();
  }

  function nearestFormant(position) {
    if (!state.formants.length) return null;
    return state.formants.reduce((best, point) => Math.abs(point.position - position) < Math.abs(best.position - position) ? point : best);
  }

  function updateFormantReadout(position = audio.duration ? audio.currentTime / audio.duration : 0) {
    const point = nearestFormant(position);
    ui.readout.textContent = point ? `F1 ${point.f1 ?? "--"} Hz  ·  F2 ${point.f2 ?? "--"} Hz` : "F1 -- Hz  ·  F2 -- Hz";
  }

  function readFormantAt(event) {
    const rect = formantCanvas.getBoundingClientRect();
    const { start, span } = visibleRange();
    updateFormantReadout(start + clamp((event.clientX - rect.left) / rect.width, 0, 1) * span);
  }

  function drawAll() {
    drawWaveform();
    drawFormants();
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
    audio.currentTime = clamp(start + (event.clientX - rect.left) / rect.width * span, 0, 1) * audio.duration;
    drawAll();
  }

  function previewGain() {
    if (!state.preview || !audio.duration) return 1;
    const fadeIn = fadeInSeconds();
    const fadeOut = fadeOutSeconds();
    let gain = 1;
    if (fadeIn && audio.currentTime < fadeIn) gain *= audio.currentTime / fadeIn;
    if (fadeOut && audio.currentTime > audio.duration - fadeOut) gain *= (audio.duration - audio.currentTime) / fadeOut;
    return clamp(gain, 0, 1);
  }

  function applyPreview() {
    const baseVolume = Number(ui.volume?.value ?? 0.9);
    audio.volume = clamp(baseVolume * previewGain(), 0, 1);
  }

  function togglePreview() {
    if (!state.buffer) return message("먼저 오디오를 선택하세요.");
    if (!fadeInSeconds() && !fadeOutSeconds()) return message("Fade In 또는 Fade Out을 선택하세요.");
    state.preview = !state.preview;
    ui.preview.classList.toggle("active", state.preview);
    ui.preview.textContent = state.preview ? "■ 미리듣기 끄기" : "▶ 미리듣기";
    applyPreview();
    message(state.preview ? "Fade 미리듣기가 적용됩니다." : "Fade 미리듣기를 껐습니다.");
  }

  async function saveFades(overwrite) {
    const path = ui.path?.textContent?.trim();
    if (!path || path === "-" || !state.buffer) return message("먼저 오디오를 선택하세요.");
    const fadeIn = fadeInSeconds();
    const fadeOut = fadeOutSeconds();
    if (!fadeIn && !fadeOut) return message("Fade In 또는 Fade Out을 선택하세요.");
    if (overwrite && !window.confirm("원본 파일을 fade 처리된 파일로 교체할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    if (state.busy) return;
    state.busy = true;
    ui.saveNew.disabled = ui.overwrite.disabled = true;
    message(overwrite ? "원본 파일에 fade를 적용하는 중…" : "fade가 적용된 새 파일을 저장하는 중…");
    try {
      const result = await invoke("apply_audio_fades", {
        path,
        fadeIn,
        fadeOut,
        duration: state.buffer.duration,
        overwrite
      });
      if (overwrite) {
        const time = audio.currentTime;
        audio.pause();
        audio.src = window.__TAURI__.core.convertFileSrc(result) + `?fade=${Date.now()}`;
        audio.load();
        audio.addEventListener("loadedmetadata", () => { audio.currentTime = Math.min(time, audio.duration || 0); }, { once: true });
      }
      message(overwrite ? "원본 파일에 fade를 적용했습니다." : `새 파일 저장 완료: ${result}`);
    } catch (error) {
      message("Fade 저장 실패: " + String(error));
    } finally {
      state.busy = false;
      ui.saveNew.disabled = ui.overwrite.disabled = false;
    }
  }

  audio.addEventListener("loadedmetadata", loadWaveform);
  audio.addEventListener("play", startWaveformRenderLoop);
  audio.addEventListener("timeupdate", () => { applyPreview(); drawAll(); });
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
  $("clear")?.addEventListener("click", () => {
    state.token++;
    state.buffer = null;
    state.peaks = [];
    state.formants = [];
    state.preview = false;
    ui.empty.classList.remove("hidden");
    ui.empty.textContent = "오디오를 선택하면 스테레오 파형을 그립니다.";
    applyPreview();
    drawAll();
  });
  [ui.fadeInEnabled, ui.fadeOutEnabled, ui.fadeInDuration, ui.fadeOutDuration].forEach((element) => element.addEventListener("change", () => {
    applyPreview();
    drawAll();
  }));
  new ResizeObserver(drawAll).observe(waveCanvas.parentElement);
  drawAll();
})();
