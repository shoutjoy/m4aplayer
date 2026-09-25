function toDb(value) {
    return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

function round(value, digits = 1) {
    return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

self.onmessage = ({ data }) => {
    const { channels, sampleRate, duration, file } = data;
    const frameSize = Math.max(1, Math.round(sampleRate * 0.05));
    const waveformBucketCount = Math.min(8192, Math.max(2048, Math.ceil(duration * 32)));
    const waveformChannels = channels.map(() => ({
        min: new Float32Array(waveformBucketCount).fill(1),
        max: new Float32Array(waveformBucketCount).fill(-1)
    }));
    const frameSquares = [];
    let min = 1;
    let max = -1;
    let peak = 0;
    let sumSquares = 0;
    let sum = 0;
    let sampleCount = 0;
    let clippedSamples = 0;
    let correlationXy = 0;
    let correlationXx = 0;
    let correlationYy = 0;

    channels.forEach((channel, channelIndex) => {
        let frameSum = 0;
        let frameCount = 0;
        for (let i = 0; i < channel.length; i += 1) {
            const value = channel[i];
            const absoluteValue = Math.abs(value);
            const waveformBucket = Math.min(
                waveformBucketCount - 1,
                Math.floor((i / Math.max(1, channel.length)) * waveformBucketCount),
            );
            if (value < waveformChannels[channelIndex].min[waveformBucket]) waveformChannels[channelIndex].min[waveformBucket] = value;
            if (value > waveformChannels[channelIndex].max[waveformBucket]) waveformChannels[channelIndex].max[waveformBucket] = value;
            min = Math.min(min, value);
            max = Math.max(max, value);
            peak = Math.max(peak, absoluteValue);
            sum += value;
            sumSquares += value * value;
            sampleCount += 1;
            if (channelIndex === 1 && channels.length === 2) {
                const leftValue = channels[0][i] || 0;
                correlationXy += leftValue * value;
                correlationXx += leftValue * leftValue;
                correlationYy += value * value;
            }
            if (Math.abs(value) >= 0.999) clippedSamples += 1;
            frameSum += value * value;
            frameCount += 1;
            if (frameCount === frameSize || i === channel.length - 1) {
                frameSquares.push(Math.sqrt(frameSum / frameCount));
                frameSum = 0;
                frameCount = 0;
            }
        }
    });

    frameSquares.sort((a, b) => a - b);
    const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
    const noiseIndex = Math.floor(Math.max(0, frameSquares.length - 1) * 0.1);
    const lowIndex = Math.floor(Math.max(0, frameSquares.length - 1) * 0.1);
    const highIndex = Math.floor(Math.max(0, frameSquares.length - 1) * 0.95);
    const noiseFloor = toDb(frameSquares[noiseIndex] || 0);
    const dynamicRange = toDb(frameSquares[highIndex] || 0) - toDb(frameSquares[lowIndex] || 0);
    const peakDb = toDb(peak);
    const rmsDb = toDb(rms);
    const dcOffset = sum / Math.max(1, sampleCount);
    waveformChannels.forEach(channel => {
        for (let index = 0; index < waveformBucketCount; index++) {
            if (channel.min[index] > channel.max[index]) {
                channel.min[index] = 0;
                channel.max[index] = 0;
            }
        }
    });
    const estimatedBitrate = duration > 0 ? (file.size * 8) / duration / 1000 : 0;
    let correlation = null;

    if (channels.length === 2) {
        correlation = correlationXy / Math.sqrt(Math.max(Number.EPSILON, correlationXx * correlationYy));
    }

    const advice = [];
    if (clippedSamples > 0) advice.push(`클리핑 샘플 ${clippedSamples.toLocaleString()}개가 감지되었습니다. 리미터 전 입력 게인을 낮추세요.`);
    else if (peakDb > -1) advice.push('피크 헤드룸이 1 dB 미만입니다. 마스터 버스 입력을 약 1~2 dB 낮추는 것이 안전합니다.');
    else advice.push(`피크 헤드룸 ${round(-peakDb, 1)} dB로 후속 마스터링 처리가 가능합니다.`);
    if (noiseFloor > -50) advice.push('노이즈 플로어가 높은 편입니다. 무음부를 확인하고 노이즈 리덕션 또는 게이트를 검토하세요.');
    else advice.push('노이즈 플로어가 일반적인 마스터링 작업 범위에 있습니다.');
    if (Math.abs(dcOffset) > 0.01) advice.push('DC 오프셋이 감지되었습니다. 20~30 Hz 하이패스 필터 또는 DC 제거를 권장합니다.');
    if (dynamicRange < 6) advice.push('다이내믹 레인지가 좁습니다. 추가 압축은 최소화하고 트랜지언트를 보존하세요.');
    else if (dynamicRange > 18) advice.push('다이내믹 편차가 큽니다. 저비율 버스 컴프레션으로 레벨을 정돈할 수 있습니다.');
    else advice.push('다이내믹 레인지는 균형 잡힌 범위입니다.');
    if (correlation !== null && correlation < 0) advice.push('스테레오 위상 상쇄 위험이 있습니다. 모노 호환성을 확인하세요.');

    self.postMessage({
        format: file.type || file.extension || '알 수 없음',
        size: file.size,
        sampleRate,
        channels: channels.length,
        duration,
        estimatedBitrate: round(estimatedBitrate, 0),
        min: round(min, 4),
        max: round(max, 4),
        peakDb: round(peakDb, 1),
        rmsDb: round(rmsDb, 1),
        noiseFloor: round(noiseFloor, 1),
        dynamicRange: round(dynamicRange, 1),
        dcOffset: round(dcOffset, 5),
        clippedSamples,
        correlation: round(correlation, 2),
        waveformPeaks: {
            version: 2,
            bucketCount: waveformBucketCount,
            channelCount: channels.length,
            channels: waveformChannels.map(channel => ({
                min: Array.from(channel.min),
                max: Array.from(channel.max)
            }))
        },
        advice
    });
};
