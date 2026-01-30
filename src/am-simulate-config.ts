export type AmSimulateConfig = {
  carrier: {
    freqRatio: number;
    modulationIndex: number;
  };
  lpf: {
    cutoff: number;
    q: number;
    stages: number;
  };
  detector: {
    attackTime: number;
    releaseTime: number;
  };
  compressor: {
    threshold: number;
    ratio: number;
    releaseTime: number;
    makeupGain: number;
  };
  diode: {
    drop: number;
    vt: number;
    gain: number;
    blend: number;
  };
  noise: {
    enabled: boolean;
    level: number;
  };
};

export const DEFAULT_AM_SIMULATE_CONFIG: AmSimulateConfig = {
  carrier: {
    freqRatio: 0.5,
    modulationIndex: 1.0,
  },
  lpf: {
    cutoff: 4000,
    q: 0.707,
    stages: 16,
  },
  detector: {
    attackTime: 0.5,
    releaseTime: 4.0,
  },
  compressor: {
    threshold: 0.01,
    ratio: 30,
    releaseTime: 0.5,
    makeupGain: 100,
  },
  diode: {
    drop: 0.55,
    vt: 0.16,
    gain: 0.03,
    blend: 0.1,
  },
  noise: {
    enabled: true,
    level: 0.02,
  },
};

export function cloneAmSimulateConfig(config: AmSimulateConfig): AmSimulateConfig {
  return JSON.parse(JSON.stringify(config));
}
