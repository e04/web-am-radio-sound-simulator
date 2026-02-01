import type { AmSimulateConfig } from "../am-simulate-config";

interface AmSimulateParamsProps {
  amConfig: AmSimulateConfig;
  onConfigChange: <
    K extends keyof AmSimulateConfig,
    F extends keyof AmSimulateConfig[K],
  >(
    section: K,
    field: F,
    value: AmSimulateConfig[K][F],
  ) => void;
}

const parseInputNumber = (value: string, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function AmSimulateParams({
  amConfig,
  onConfigChange,
}: AmSimulateParamsProps) {
  return (
    <div className="params-section">
      <div className="param-group">
        <div className="param-group-title">Carrier</div>
        <div className="param-grid">
          <div className="param-item">
            <label className="param-label">Modulation Index</label>
            <input
              className="param-input"
              type="number"
              step="0.05"
              value={amConfig.carrier.modulationIndex}
              onChange={(e) =>
                onConfigChange(
                  "carrier",
                  "modulationIndex",
                  parseInputNumber(e.target.value, 0),
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="param-group">
        <div className="param-group-title">Noise</div>
        <div className="param-grid">
          <div className="param-item">
            <label className="param-checkbox">
              <input
                type="checkbox"
                checked={amConfig.noise.enabled}
                onChange={(e) =>
                  onConfigChange("noise", "enabled", e.target.checked)
                }
              />
              <span className="param-checkbox-label">Enable Noise</span>
            </label>
          </div>
          <div className="param-item">
            <label className="param-label">Level</label>
            <input
              className="param-input"
              type="number"
              step="0.005"
              value={amConfig.noise.level}
              onChange={(e) =>
                onConfigChange(
                  "noise",
                  "level",
                  parseInputNumber(e.target.value, 0),
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="param-group">
        <div className="param-group-title">Diode</div>
        <div className="param-grid">
          <div className="param-item">
            <label className="param-label">Drop</label>
            <input
              className="param-input"
              type="number"
              step="0.01"
              value={amConfig.diode.drop}
              onChange={(e) =>
                onConfigChange(
                  "diode",
                  "drop",
                  parseInputNumber(e.target.value, 0),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Vt</label>
            <input
              className="param-input"
              type="number"
              step="0.01"
              value={amConfig.diode.vt}
              onChange={(e) =>
                onConfigChange(
                  "diode",
                  "vt",
                  parseInputNumber(e.target.value, 0.01),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Gain</label>
            <input
              className="param-input"
              type="number"
              step="0.01"
              value={amConfig.diode.gain}
              onChange={(e) =>
                onConfigChange(
                  "diode",
                  "gain",
                  parseInputNumber(e.target.value, 0),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Blend</label>
            <input
              className="param-input"
              type="number"
              step="0.01"
              value={amConfig.diode.blend}
              onChange={(e) =>
                onConfigChange(
                  "diode",
                  "blend",
                  parseInputNumber(e.target.value, 0),
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="param-group">
        <div className="param-group-title">Envelope Detector</div>
        <div className="param-grid">
          <div className="param-item">
            <label className="param-label">Attack (carrier periods)</label>
            <input
              className="param-input"
              type="number"
              step="0.1"
              value={amConfig.detector.attackTime}
              onChange={(e) =>
                onConfigChange(
                  "detector",
                  "attackTime",
                  parseInputNumber(e.target.value, 0.1),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Release (carrier periods)</label>
            <input
              className="param-input"
              type="number"
              step="0.1"
              value={amConfig.detector.releaseTime}
              onChange={(e) =>
                onConfigChange(
                  "detector",
                  "releaseTime",
                  parseInputNumber(e.target.value, 0.1),
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="param-group">
        <div className="param-group-title">Compressor</div>
        <div className="param-grid">
          <div className="param-item">
            <label className="param-label">Threshold</label>
            <input
              className="param-input"
              type="number"
              step="0.001"
              value={amConfig.compressor.threshold}
              onChange={(e) =>
                onConfigChange(
                  "compressor",
                  "threshold",
                  parseInputNumber(e.target.value, 0.0001),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Ratio</label>
            <input
              className="param-input"
              type="number"
              step="1"
              value={amConfig.compressor.ratio}
              onChange={(e) =>
                onConfigChange(
                  "compressor",
                  "ratio",
                  parseInputNumber(e.target.value, 1),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Release</label>
            <input
              className="param-input"
              type="number"
              step="0.05"
              value={amConfig.compressor.releaseTime}
              onChange={(e) =>
                onConfigChange(
                  "compressor",
                  "releaseTime",
                  parseInputNumber(e.target.value, 0.05),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Makeup Gain</label>
            <input
              className="param-input"
              type="number"
              step="1"
              value={amConfig.compressor.makeupGain}
              onChange={(e) =>
                onConfigChange(
                  "compressor",
                  "makeupGain",
                  parseInputNumber(e.target.value, 1),
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="param-group">
        <div className="param-group-title">Low Pass Filter</div>
        <div className="param-grid">
          <div className="param-item">
            <label className="param-label">Cutoff</label>
            <input
              className="param-input"
              type="number"
              step="100"
              value={amConfig.lpf.cutoff}
              onChange={(e) =>
                onConfigChange(
                  "lpf",
                  "cutoff",
                  parseInputNumber(e.target.value, 10),
                )
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Q Factor</label>
            <input
              className="param-input"
              type="number"
              step="0.01"
              value={amConfig.lpf.q}
              onChange={(e) =>
                onConfigChange("lpf", "q", parseInputNumber(e.target.value, 0.1))
              }
            />
          </div>
          <div className="param-item">
            <label className="param-label">Stages</label>
            <input
              className="param-input"
              type="number"
              step="1"
              value={amConfig.lpf.stages}
              onChange={(e) =>
                onConfigChange(
                  "lpf",
                  "stages",
                  parseInt(e.target.value || "1", 10) || 1,
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
