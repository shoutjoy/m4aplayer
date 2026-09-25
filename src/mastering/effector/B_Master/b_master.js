export class BMasterController {
    constructor(audioState) {
        this.audioState = audioState;
        this.isBypassed = false;
        this.onBypassChange = null;
    }

    init(callbacks) {
        this.getAudioCtx = callbacks.getAudioCtx;
        this.getIsPlaying = callbacks.getIsPlaying;
        this.getEffectorRegistry = callbacks.getEffectorRegistry;
        this.getStemFilters = callbacks.getStemFilters;
        this.getActiveStemIds = callbacks.getActiveStemIds;
        this.getStemRegistry = callbacks.getStemRegistry;
        this.applyUtilitySettings = callbacks.applyUtilitySettings;
        this.getMasterGainNode = callbacks.getMasterGainNode;
        if (callbacks.onBypassChange) {
            this.onBypassChange = callbacks.onBypassChange;
        }
    }

    isBypassMode() {
        return this.isBypassed;
    }

    setBypass(bypassed) {
        this.isBypassed = bypassed;
        if (this.onBypassChange) {
            this.onBypassChange(bypassed);
        }
        this.updateUI();
        this.applyRouting();
    }

    updateUI() {
        const btnA = document.getElementById('bypass-a');
        const btnB = document.getElementById('bypass-b');
        if (!btnA || !btnB) return;

        if (this.isBypassed) {
            btnA.className = "px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-600 text-white shadow-md";
            btnB.className = "px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-400 hover:text-white";
        } else {
            btnA.className = "px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-400 hover:text-white";
            btnB.className = "px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-600 text-white shadow-md";
        }
    }

    applyRouting() {
        const isPlaying = this.getIsPlaying ? this.getIsPlaying() : false;
        const audioCtx = this.getAudioCtx ? this.getAudioCtx() : null;
        if (!isPlaying || !audioCtx) return;

        const effectors = this.getEffectorRegistry ? this.getEffectorRegistry() : {};
        const stemFilters = this.getStemFilters ? this.getStemFilters() : {};
        const activeStemIds = this.getActiveStemIds ? this.getActiveStemIds() : [];
        const stemRegistry = this.getStemRegistry ? this.getStemRegistry() : [];
        const masterGainNode = this.getMasterGainNode ? this.getMasterGainNode() : null;

        const isBypassed = this.isBypassed;

        // 1. EQ Settings
        if (effectors.eq) {
            effectors.eq.applySettings(audioCtx, isBypassed);
        }

        // 2. Stems
        const stemsDisabled = isBypassed || !this.audioState.stemsEnabled;
        stemRegistry.forEach(stem => {
            if (activeStemIds.includes(stem.id) && stemFilters[stem.id]) {
                const gainVal = stemsDisabled ? 0 : (this.audioState.mutes[stem.id] ? -40 : this.audioState.stems[stem.id]);
                stemFilters[stem.id].gain.setValueAtTime(gainVal, audioCtx.currentTime);
            }
        });

        // 3. Utility Settings (Noise, De-Esser, Saturator)
        if (this.applyUtilitySettings) {
            this.applyUtilitySettings(audioCtx);
        }

        // 4. Reverb Settings
        if (effectors.reverb) {
            effectors.reverb.applySettings(audioCtx, () => isBypassed);
        }

        // 5. Compressor Settings
        if (effectors.compressor) {
            effectors.compressor.applySettings(audioCtx, () => isBypassed);
        }

        // 6. Limiter Settings
        if (effectors.limiter) {
            effectors.limiter.applySettings(audioCtx, () => isBypassed);
        }

        // 7. Master Gain
        if (masterGainNode) {
            const targetGain = isBypassed ? 1.0 : (this.audioState.master / 100);
            masterGainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);
        }
    }

    bindControls() {
        const btnA = document.getElementById('bypass-a');
        const btnB = document.getElementById('bypass-b');
        if (btnA) btnA.onclick = () => this.setBypass(true);
        if (btnB) btnB.onclick = () => this.setBypass(false);
        this.updateUI();
    }
}
