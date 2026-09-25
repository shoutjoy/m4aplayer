const $ = (id) => document.getElementById(id);

function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** unit)).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function readableFormat(file) {
    const extension = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'AUDIO';
    return file.type ? `${extension} · ${file.type}` : extension;
}

function setStatus(status, label) {
    const element = $('audio-analysis-status');
    if (!element) return;
    element.className = `audio-analysis-status is-${status}`;
    element.innerHTML = status === 'running'
        ? `<i class="fa-solid fa-spinner"></i> ${label}`
        : label;
}

function renderReport(report, file) {
    const metrics = [
        ['종류', readableFormat(file)],
        ['재생 시간', formatDuration(report.duration)],
        ['샘플레이트 / 채널', `${(report.sampleRate / 1000).toFixed(1)} kHz · ${report.channels === 1 ? 'Mono' : report.channels === 2 ? 'Stereo' : `${report.channels} ch`}`],
        ['파일 / 추정 비트레이트', `${formatBytes(report.size)} · ${report.estimatedBitrate} kbps`],
        ['최대값 / 최소값', `${report.max} / ${report.min}`],
        ['피크 / 평균 레벨', `${report.peakDb} / ${report.rmsDb} dBFS`],
        ['노이즈 플로어', `${report.noiseFloor} dBFS`],
        ['다이내믹 레인지', `${report.dynamicRange} dB`],
        ['DC 오프셋', String(report.dcOffset)],
        ['클리핑 / 위상 상관도', `${report.clippedSamples.toLocaleString()} · ${report.correlation ?? 'N/A'}`]
    ];
    const container = $('audio-analysis-metrics');
    container.replaceChildren(...metrics.map(([label, value]) => {
        const item = document.createElement('div');
        item.className = 'audio-analysis-metric';
        const caption = document.createElement('span');
        caption.textContent = label;
        const strong = document.createElement('strong');
        strong.textContent = value;
        strong.title = value;
        item.append(caption, strong);
        return item;
    }));
    const advice = $('audio-analysis-advice');
    advice.replaceChildren(...report.advice.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
    }));
}

function runAnalysis(buffer, file, jobId, isCurrentJob, onAnalysis) {
    const workerUrl = new URL('UploadeFiles/audio-analysis.worker.js?v=20260918-2', document.baseURI);
    const worker = new Worker(workerUrl);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice());
    worker.onmessage = ({ data }) => {
        if (!isCurrentJob(jobId)) return worker.terminate();
        renderReport(data, file);
        onAnalysis?.({ file, report: data, waveformPeaks: data.waveformPeaks || [] });
        setStatus('done', '분석 완료');
        worker.terminate();
    };
    worker.onerror = () => {
        if (isCurrentJob(jobId)) setStatus('error', '분석 실패');
        worker.terminate();
    };
    worker.postMessage({
        channels,
        sampleRate: buffer.sampleRate,
        duration: buffer.duration,
        file: {
            type: file.type,
            extension: file.name.split('.').pop()?.toUpperCase(),
            size: file.size
        }
    }, channels.map((channel) => channel.buffer));
    return worker;
}

function initAudioUpload({ input, getAudioContext, onLoading, onDecoded, onAnalysis, onError }) {
    const dropZone = $('audio-drop-zone');
    const summary = $('audio-analysis-summary');
    const toggle = $('audio-analysis-toggle');
    const content = $('audio-analysis-content');
    const chevron = $('audio-analysis-chevron');
    let currentJob = 0;
    let activeWorker = null;

    if (!input || !dropZone || !summary || !toggle || !content || !chevron) {
        console.error('Audio upload UI initialization failed: required element is missing.');
        return;
    }

    const setExpanded = (expanded) => {
        content.classList.toggle('hidden', !expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
        chevron.className = `fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-gray-500`;
    };

    const openFilePicker = () => {
        // input.click() is supported more consistently than showPicker() in
        // embedded Chromium/WebView hosts. Keep showPicker as a fallback only.
        try {
            input.click();
        } catch (clickError) {
            try {
                input.showPicker?.();
            } catch (pickerError) {
                onError?.(pickerError || clickError);
            }
        }
    };

    const getDroppedFiles = (dataTransfer) => {
        const directFiles = Array.from(dataTransfer?.files || []).filter(Boolean);
        if (directFiles.length) return directFiles;

        const files = [];
        for (const item of Array.from(dataTransfer?.items || [])) {
            if (item.kind !== 'file') continue;
            const file = item.getAsFile?.();
            if (file) files.push(file);
        }
        return files;
    };

    const isDropZoneEvent = (event) => {
        const path = event.composedPath?.() || [];
        return path.includes(dropZone) || Boolean(event.target && dropZone.contains(event.target));
    };

    const processFile = async (file, batchIndex = 0, batchTotal = 1) => {
        if (!file) return false;
        if (!file.type.startsWith('audio/') && !/\.(wav|mp3|flac|m4a|aac|ogg|opus|aiff?)$/i.test(file.name)) {
            onError?.(new Error('지원되는 오디오 파일을 선택해 주세요.'));
            return false;
        }

        const jobId = ++currentJob;
        if (activeWorker) {
            activeWorker.terminate();
            activeWorker = null;
        }
        summary.classList.remove('hidden');
        $('audio-analysis-file').textContent = file.name;
        setExpanded(false);
        setStatus('running', '디코딩 중');
        onLoading?.(file);
        performance.mark('audio-file-read-start');

        try {
            const context = await getAudioContext();
            const arrayBuffer = typeof file.arrayBuffer === 'function'
                ? await file.arrayBuffer()
                : await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error || new Error('파일을 읽지 못했습니다.'));
                    reader.readAsArrayBuffer(file);
                });
            performance.mark('audio-file-read-end');
            performance.measure('audio-file-read', 'audio-file-read-start', 'audio-file-read-end');
            performance.mark('audio-decode-start');
            const buffer = await new Promise((resolve, reject) => {
                let settled = false;
                const complete = (value) => {
                    if (settled) return;
                    settled = true;
                    resolve(value);
                };
                const fail = (error) => {
                    if (settled) return;
                    settled = true;
                    reject(error || new Error('오디오 디코딩에 실패했습니다.'));
                };

                try {
                    const result = context.decodeAudioData(arrayBuffer.slice(0), complete, fail);
                    if (result?.then) result.then(complete, fail);
                } catch (error) {
                    fail(error);
                }
            });
            performance.mark('audio-decode-end');
            performance.measure('audio-decode', 'audio-decode-start', 'audio-decode-end');
            if (jobId !== currentJob) return false;
            performance.mark('audio-post-decode-start');
            await onDecoded?.({ file, buffer, batchIndex, batchTotal });
            performance.mark('audio-post-decode-end');
            performance.measure('audio-post-decode', 'audio-post-decode-start', 'audio-post-decode-end');
            setStatus('running', '로드 완료 · 분석 중');
            try {
                activeWorker = runAnalysis(buffer, file, jobId, (id) => id === currentJob, onAnalysis);
            } catch (analysisError) {
                // Local file viewers can block Web Workers. The decoded audio is
                // already usable, so keep the upload successful in that case.
                console.warn('Background audio analysis is unavailable:', analysisError);
                setStatus('error', '분석 미지원');
            }
            return true;
        } catch (error) {
            if (jobId !== currentJob) return false;
            setStatus('error', '처리 실패');
            onError?.(error);
            return false;
        } finally {
            input.value = '';
        }
    };

    input.addEventListener('change', (event) => {
        const files = Array.from(event.currentTarget?.files || event.target?.files || []).filter(Boolean);
        if (!files.length) return;
        void (async () => {
            for (let index = 0; index < files.length; index += 1) {
                await processFile(files[index], index, files.length);
            }
        })();
    });
    dropZone.addEventListener('click', (event) => {
        event.preventDefault();
        openFilePicker();
    });
    dropZone.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openFilePicker();
    });
    toggle.addEventListener('click', () => setExpanded(toggle.getAttribute('aria-expanded') !== 'true'));

    ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        dropZone.classList.add('is-dragging');
    }));
    dropZone.addEventListener('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('is-dragging');
    });

    // Capture the drop before nested elements or host-app listeners can consume it.
    document.addEventListener('dragover', (event) => {
        if (!isDropZoneEvent(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }, true);

    document.addEventListener('drop', (event) => {
        if (!isDropZoneEvent(event)) return;
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('is-dragging');
        const files = getDroppedFiles(event.dataTransfer);
        if (files.length) {
            dropZone.dataset.dropState = 'received';
            void (async () => {
                for (let index = 0; index < files.length; index += 1) {
                    await processFile(files[index], index, files.length);
                }
            })();
            return;
        }

        dropZone.dataset.dropState = 'empty';
        summary.classList.remove('hidden');
        $('audio-analysis-file').textContent = '드롭된 파일을 읽지 못했습니다';
        setStatus('error', '파일 없음');
        onError?.(new Error('드롭된 파일을 읽을 수 없습니다. Windows 탐색기에서 WAV 파일을 다시 드롭해 주세요.'));
    }, true);

    return {
        importFile(file) { return processFile(file, 0, 1); },
        reset() {
            currentJob += 1;
            if (activeWorker) activeWorker.terminate();
            activeWorker = null;
            input.value = '';
            dropZone.classList.remove('is-dragging');
            delete dropZone.dataset.dropState;
            summary.classList.add('hidden');
            setExpanded(false);
            $('audio-analysis-file').textContent = '분석 리포트';
            $('audio-analysis-metrics')?.replaceChildren();
            $('audio-analysis-advice')?.replaceChildren();
            setStatus('done', '대기');
        }
    };
}
