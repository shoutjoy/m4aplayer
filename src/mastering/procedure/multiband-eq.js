/**
 * MultiBandEQ Class - Web Audio API based 6-Band Graphic/Parametric Equalizer
 * This class implements a chain of 6 BiquadFilterNodes (lowshelf, peaking, highshelf)
 * to control low, low-mid, mid, high-mid, high, and air frequencies.
 */
export class MultiBandEQ {
  constructor(audioContext, options = {}) {
    this.ctx = audioContext;

    // Input and Output gain nodes for routing and level matching
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    // Default band configurations: frequency (Hz), Q-factor, and gain (dB)
    this.bands = [
      { id: 1, type: "lowshelf",  freq: 90,    q: 0.7, gain: 0, label: "Sub/Bass (저역)" },
      { id: 2, type: "peaking",   freq: 250,   q: 1.2, gain: 0, label: "Low-Mid (중저역)" },
      { id: 3, type: "peaking",   freq: 600,   q: 1.5, gain: 0, label: "Mid (중역)" },
      { id: 4, type: "peaking",   freq: 1000,  q: 1.2, gain: 0, label: "Nasal/Vocal (중고역)" },
      { id: 5, type: "peaking",   freq: 3500,  q: 1.0, gain: 0, label: "Presence (고역)" },
      { id: 6, type: "highshelf", freq: 7000,  q: 0.7, gain: 0, label: "Air/Sheen (초고역)" }
    ];

    // Create the BiquadFilterNode instances
    this.filters = this.bands.map(band => {
      const filter = this.ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.freq;
      filter.Q.value = band.q;
      filter.gain.value = band.gain;
      return filter;
    });

    // Establish the serial DSP chain
    this._connectChain();
  }

  /**
   * Connects the filter nodes in a serial chain:
   * Input -> Filter 1 -> Filter 2 -> ... -> Filter 6 -> Output
   * @private
   */
  _connectChain() {
    this.input.disconnect();

    this.input.connect(this.filters[0]);

    for (let i = 0; i < this.filters.length - 1; i++) {
      this.filters[i].connect(this.filters[i + 1]);
    }

    this.filters[this.filters.length - 1].connect(this.output);
  }

  /**
   * Connects the output of the EQ to a Web Audio destination node
   * @param {AudioNode} destination 
   */
  connect(destination) {
    this.output.connect(destination);
  }

  /**
   * Disconnects the output of the EQ from its destinations
   */
  disconnect() {
    this.output.disconnect();
  }

  /**
   * Set configuration parameters of a specific band
   * @param {number} index - Band index (1-based, 1 to 6)
   * @param {Object} params - { frequency, q, gain, type }
   */
  setBand(index, { frequency, q, gain, type } = {}) {
    const filter = this.filters[index - 1];
    if (!filter) return;

    const now = this.ctx.currentTime;

    if (type) {
      filter.type = type;
      this.bands[index - 1].type = type;
    }

    if (frequency !== undefined) {
      filter.frequency.setTargetAtTime(frequency, now, 0.01);
      this.bands[index - 1].freq = frequency;
    }

    if (q !== undefined) {
      filter.Q.setTargetAtTime(q, now, 0.01);
      this.bands[index - 1].q = q;
    }

    if (gain !== undefined) {
      filter.gain.setTargetAtTime(gain, now, 0.01);
      this.bands[index - 1].gain = gain;
    }
  }

  /**
   * Set gain for a specific band
   * @param {number} index - Band index (1 to 6)
   * @param {number} gainDb - Gain in decibels
   */
  setGain(index, gainDb) {
    this.setBand(index, { gain: gainDb });
  }

  /**
   * Set cutoff/center frequency for a specific band
   * @param {number} index - Band index (1 to 6)
   * @param {number} freqHz - Frequency in Hertz
   */
  setFrequency(index, freqHz) {
    this.setBand(index, { frequency: freqHz });
  }

  /**
   * Set Q factor for a specific band
   * @param {number} index - Band index (1 to 6)
   * @param {number} qValue - Q value
   */
  setQ(index, qValue) {
    this.setBand(index, { q: qValue });
  }

  /**
   * Bypass the EQ processing chain
   * @param {boolean} isBypass - true to bypass (route directly Input -> Output), false to process
   */
  bypass(isBypass = true) {
    this.input.disconnect();

    if (isBypass) {
      this.input.connect(this.output);
    } else {
      this._connectChain();
    }
  }

  /**
   * Calculates the overall frequency response curve of the multiband EQ
   * @param {number} points - Number of resolution points for the frequency plot
   * @returns {Object} - { frequencies: Float32Array, magnitude: Float32Array, db: Array }
   */
  getFrequencyResponse(points = 512) {
    const minFreq = 20;
    const maxFreq = 20000;

    const freqs = new Float32Array(points);
    const mag = new Float32Array(points);
    const phase = new Float32Array(points);

    // Compute logarithmic frequency points from 20Hz to 20kHz
    for (let i = 0; i < points; i++) {
      const ratio = i / (points - 1);
      freqs[i] = minFreq * Math.pow(maxFreq / minFreq, ratio);
    }

    const totalMag = new Float32Array(points).fill(1);

    // Multiply the magnitude response of each filter
    this.filters.forEach(filter => {
      filter.getFrequencyResponse(freqs, mag, phase);
      for (let i = 0; i < points; i++) {
        totalMag[i] *= mag[i];
      }
    });

    return {
      frequencies: freqs,
      magnitude: totalMag,
      db: Array.from(totalMag).map(v => 20 * Math.log10(v))
    };
  }
}
