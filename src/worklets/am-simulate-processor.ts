
import type { AmSimulateConfig } from "../am-simulate-config";
import { DEFAULT_AM_SIMULATE_CONFIG, cloneAmSimulateConfig } from "../am-simulate-config";

/**
 * Simple Biquad Filter (Low Pass)
 */
class BiquadFilter {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private a0 = 0;
  private a1 = 0;
  private a2 = 0;
  private b1 = 0;
  private b2 = 0;

  updateCoefficients(sampleRate: number, cutoff: number, q: number) {
    const omega = (2 * Math.PI * cutoff) / sampleRate;
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    const alpha = sinOmega / (2 * q);

    const b0 = (1 - cosOmega) / 2;
    const b1 = 1 - cosOmega;
    const b2 = (1 - cosOmega) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosOmega;
    const a2 = 1 - alpha;

    // Normalize
    this.a0 = b0 / a0;
    this.a1 = b1 / a0;
    this.a2 = b2 / a0;
    this.b1 = a1 / a0;
    this.b2 = a2 / a0;
  }

  process(input: number): number {
    const output =
      this.a0 * input +
      this.a1 * this.x1 +
      this.a2 * this.x2 -
      this.b1 * this.y1 -
      this.b2 * this.y2;

    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;

    return output;
  }
}

/**
 * Handles signal processing for a single audio channel.
 * Encapsulates state for AM modulation, envelope detection, AGC, and filtering.
 */
class AmChannelProcessor {
  private config: AmSimulateConfig;
  private readonly sampleRate: number;

  // Carrier State
  private phase = 0;
  private phaseStep = 0;
  
  // Envelope Detector State
  private envelope = 0;
  private attackCoeff = 0;
  private releaseCoeff = 0;

  // Compressor State
  private compEnvelope = 0;
  private compReleaseCoeff = 0;

  // Filters (Cascaded)
  private lpfStages: BiquadFilter[] = [];

  // Noise State
  private noiseEnabled = false;
  private noiseLevel = 0;
  private noiseState = 1;

  constructor(sampleRate: number, config: AmSimulateConfig) {
    this.sampleRate = sampleRate;
    this.config = cloneAmSimulateConfig(config);
    this.recomputeFromConfig();
  }

  updateConfig(config: AmSimulateConfig): void {
    this.config = cloneAmSimulateConfig(config);
    this.recomputeFromConfig();
  }

  private recomputeFromConfig(): void {
    const freqRatio = Math.max(1e-6, this.config.carrier.freqRatio);
    const carrierFreq = this.sampleRate * freqRatio;
    this.phaseStep = (2 * Math.PI * carrierFreq) / this.sampleRate;

    const carrierPeriod = 1 / carrierFreq;
    this.attackCoeff = Math.exp(-1 / (this.sampleRate * (carrierPeriod * this.config.detector.attackTime)));
    this.releaseCoeff = Math.exp(-1 / (this.sampleRate * (carrierPeriod * this.config.detector.releaseTime)));

    this.compReleaseCoeff = Math.exp(-1 / (this.sampleRate * this.config.compressor.releaseTime));

    const stages = Math.max(1, Math.round(this.config.lpf.stages));
    if (this.lpfStages.length !== stages) {
      this.lpfStages = Array.from({ length: stages }, () => new BiquadFilter());
    }
    this.lpfStages.forEach((filter) => {
      filter.updateCoefficients(this.sampleRate, this.config.lpf.cutoff, this.config.lpf.q);
    });

    this.noiseEnabled = this.config.noise.enabled;
    this.noiseLevel = this.config.noise.level;
  }

  processSample(sample: number): { output: number; modulated: number } {
    const modulated = this.modulate(sample);
    const noisy = this.noiseEnabled ? modulated + this.whiteNoise() : modulated;

    const rectified = this.applyDiodeRectifier(noisy);
    this.updateEnvelope(rectified);

    const demodulated = (this.envelope - 1) / this.config.carrier.modulationIndex;
    const compressed = this.applyCompressor(demodulated);
    const filtered = this.lpfStages.reduce((signal, filter) => filter.process(signal), compressed);

    return { 
      output: Math.max(-1, Math.min(1, filtered)),
      modulated: noisy 
    };
  }

  private whiteNoise(): number {
    let x = this.noiseState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.noiseState = x;

    const normalized = ((x >>> 0) / 0xffffffff) * 2 - 1;
    return normalized * this.noiseLevel;
  }

  private modulate(audioSample: number): number {
    const carrier = Math.cos(this.phase);
    const signal = (1 + this.config.carrier.modulationIndex * audioSample) * carrier;
    
    this.phase += this.phaseStep;
    if (this.phase >= 2 * Math.PI) {
      this.phase -= 2 * Math.PI;
    }
    return signal;
  }

  private applyDiodeRectifier(sample: number): number {
    const { drop, vt, gain, blend } = this.config.diode;
    
    const halfWave = Math.max(0, sample);
    const v = sample - drop;
    let diode = 0;
    
    if (v > 0) {
      diode = Math.expm1(v / vt) * gain;
    }
    
    return halfWave * (1 - blend) + diode * blend;
  }

  private updateEnvelope(rectifiedInput: number): void {
    if (rectifiedInput > this.envelope) {
      this.envelope = this.attackCoeff * this.envelope + (1 - this.attackCoeff) * rectifiedInput;
    } else {
      this.envelope = this.releaseCoeff * this.envelope + (1 - this.releaseCoeff) * rectifiedInput;
    }
  }

  private applyCompressor(input: number): number {
    const absInput = Math.abs(input);
    const { threshold, ratio, makeupGain } = this.config.compressor;

    if (absInput > this.compEnvelope) {
      this.compEnvelope = absInput;
    } else {
      this.compEnvelope = 
        this.compReleaseCoeff * this.compEnvelope + 
        (1 - this.compReleaseCoeff) * absInput;
    }

    let gain = 1.0;
    if (this.compEnvelope > threshold) {
      const excessDb = 20 * Math.log10(this.compEnvelope / threshold);
      const compressedExcessDb = excessDb / ratio;
      const targetLevel = threshold * Math.pow(10, compressedExcessDb / 20);
      gain = targetLevel / this.compEnvelope;
    }

    return input * gain * makeupGain;
  }
}

/**
 * Main AudioWorkletProcessor
 */
class AmSimulateProcessor extends AudioWorkletProcessor {
  private channels: AmChannelProcessor[] = [];
  private config: AmSimulateConfig = cloneAmSimulateConfig(DEFAULT_AM_SIMULATE_CONFIG);
  
  // FFT for spectrum analysis
  private fft: FFT | null = null;
  private fftSize = 2048;
  private modulatedBuffer: Float32Array = new Float32Array(2048);
  private bufferIndex = 0;
  private spectrumEnabled = false;
  private frameCounter = 0;
  private readonly spectrumUpdateInterval = 4; // Update every N frames (128 samples each)

  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (event.data.type === "startSpectrum") {
        this.fftSize = event.data.fftSize || 2048;
        this.fft = new FFT(this.fftSize);
        this.modulatedBuffer = new Float32Array(this.fftSize);
        this.bufferIndex = 0;
        this.spectrumEnabled = true;
      } else if (event.data.type === "stopSpectrum") {
        this.spectrumEnabled = false;
        this.fft = null;
      } else if (event.data.type === "updateConfig" && event.data.config) {
        this.applyConfig(event.data.config as AmSimulateConfig);
      }
    };
  }

  private applyConfig(config: AmSimulateConfig): void {
    this.config = cloneAmSimulateConfig(config);
    this.channels.forEach((channel) => channel.updateConfig(this.config));
  }

  private sendSpectrum(): void {
    if (!this.fft || !this.spectrumEnabled) return;

    const real = new Float32Array(this.fftSize);
    const imag = new Float32Array(this.fftSize);

    for (let i = 0; i < this.fftSize; i++) {
      const windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)));
      real[i] = this.modulatedBuffer[i] * windowValue;
      imag[i] = 0;
    }

    this.fft.forward(real, imag);
    const magnitudes = this.fft.getMagnitudes(real, imag);

    this.port.postMessage({ type: "spectrum", data: magnitudes });
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !output || input.length === 0) {
      return true;
    }

    if (this.channels.length !== input.length) {
      this.channels = input.map(() => new AmChannelProcessor(sampleRate, this.config));
    }

    for (let ch = 0; ch < input.length; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];
      const processor = this.channels[ch];

      if (!inputChannel || !outputChannel || !processor) continue;

      for (let i = 0; i < inputChannel.length; i++) {
        const result = processor.processSample(inputChannel[i]);
        outputChannel[i] = result.output;

        if (ch === 0 && this.spectrumEnabled) {
          this.modulatedBuffer[this.bufferIndex] = result.modulated;
          this.bufferIndex = (this.bufferIndex + 1) % this.fftSize;
        }
      }
    }

    if (this.spectrumEnabled) {
      this.frameCounter++;
      if (this.frameCounter >= this.spectrumUpdateInterval) {
        this.frameCounter = 0;
        this.sendSpectrum();
      }
    }

    return true;
  }
}

/**
 * Simple FFT implementation for spectrum analysis
 */
class FFT {
  private size: number;
  private cosTable: Float32Array;
  private sinTable: Float32Array;
  private reverseTable: Uint32Array;

  constructor(size: number) {
    this.size = size;
    this.cosTable = new Float32Array(size / 2);
    this.sinTable = new Float32Array(size / 2);
    this.reverseTable = new Uint32Array(size);

    for (let i = 0; i < size / 2; i++) {
      this.cosTable[i] = Math.cos((2 * Math.PI * i) / size);
      this.sinTable[i] = Math.sin((2 * Math.PI * i) / size);
    }

    let limit = 1;
    let bit = size >> 1;
    while (limit < size) {
      for (let i = 0; i < limit; i++) {
        this.reverseTable[i + limit] = this.reverseTable[i] + bit;
      }
      limit <<= 1;
      bit >>= 1;
    }
  }

  forward(real: Float32Array, imag: Float32Array): void {
    const n = this.size;

    for (let i = 0; i < n; i++) {
      const j = this.reverseTable[i];
      if (j > i) {
        let temp = real[i];
        real[i] = real[j];
        real[j] = temp;
        temp = imag[i];
        imag[i] = imag[j];
        imag[j] = temp;
      }
    }

    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const tableStep = n / size;

      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const k = j * tableStep;
          const cos = this.cosTable[k];
          const sin = this.sinTable[k];
          const idx1 = i + j;
          const idx2 = i + j + halfSize;

          const tReal = cos * real[idx2] + sin * imag[idx2];
          const tImag = cos * imag[idx2] - sin * real[idx2];

          real[idx2] = real[idx1] - tReal;
          imag[idx2] = imag[idx1] - tImag;
          real[idx1] += tReal;
          imag[idx1] += tImag;
        }
      }
    }
  }

  getMagnitudes(real: Float32Array, imag: Float32Array): Float32Array {
    const magnitudes = new Float32Array(this.size / 2);
    for (let i = 0; i < this.size / 2; i++) {
      magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / this.size;
    }
    return magnitudes;
  }
}

registerProcessor('am-simulate-processor', AmSimulateProcessor);
