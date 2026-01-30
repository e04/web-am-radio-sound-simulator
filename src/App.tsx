import { useEffect, useState, useRef } from "react";
import passthroughProcessorUrl from "./worklets/passthrough-processor.ts?worker&url";
import amSimulateProcessorUrl from "./worklets/am-simulate-processor.ts?worker&url";
import type { AmSimulateConfig } from "./am-simulate-config";
import {
  DEFAULT_AM_SIMULATE_CONFIG,
  cloneAmSimulateConfig,
} from "./am-simulate-config";
import { Scope } from "./components/Scope";
import "./App.css";

type ProcessorType = "passthrough" | "am-simulate";
const processorOptions: {
  value: ProcessorType;
  label: string;
  url: string;
  name: string;
}[] = [
  {
    value: "passthrough",
    label: "passthrough-processor",
    url: passthroughProcessorUrl,
    name: "passthrough-processor",
  },
  {
    value: "am-simulate",
    label: "am-simulate-processor",
    url: amSimulateProcessorUrl,
    name: "am-simulate-processor",
  },
];

function App() {
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("selectedInputId") || "";
  });
  const [selectedOutputId, setSelectedOutputId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("selectedOutputId") || "";
  });
  const [selectedProcessor, setSelectedProcessor] = useState<ProcessorType>(
    () => {
      if (typeof window === "undefined") return "passthrough";
      const stored = localStorage.getItem(
        "selectedProcessor",
      ) as ProcessorType | null;
      return stored === "passthrough" || stored === "am-simulate"
        ? stored
        : "passthrough";
    },
  );
  const [amConfig, setAmConfig] = useState<AmSimulateConfig>(() =>
    cloneAmSimulateConfig(DEFAULT_AM_SIMULATE_CONFIG),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentWorkletNode, setCurrentWorkletNode] =
    useState<AudioWorkletNode | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const loadedProcessorsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === "audioinput");
        const outputs = devices.filter((d) => d.kind === "audiooutput");
        setInputDevices(inputs);
        setOutputDevices(outputs);

        setSelectedInputId((current) => {
          if (inputs.length === 0) return "";
          if (current && inputs.some((d) => d.deviceId === current))
            return current;
          return inputs[0].deviceId;
        });

        setSelectedOutputId((current) => {
          if (outputs.length === 0) return "";
          if (current && outputs.some((d) => d.deviceId === current))
            return current;
          return outputs[0].deviceId;
        });
      } catch (err) {
        console.error("Failed to get devices:", err);
      }
    };

    getDevices();

    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getDevices);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedInputId) {
      localStorage.setItem("selectedInputId", selectedInputId);
    } else {
      localStorage.removeItem("selectedInputId");
    }
  }, [selectedInputId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedOutputId) {
      localStorage.setItem("selectedOutputId", selectedOutputId);
    } else {
      localStorage.removeItem("selectedOutputId");
    }
  }, [selectedOutputId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("selectedProcessor", selectedProcessor);
  }, [selectedProcessor]);

  const sendAmConfig = (
    node: AudioWorkletNode | null,
    config: AmSimulateConfig,
  ) => {
    if (!node) return;
    node.port.start();
    node.port.postMessage({ type: "updateConfig", config });
  };

  const handleAmConfigChange = <
    K extends keyof AmSimulateConfig,
    F extends keyof AmSimulateConfig[K],
  >(
    section: K,
    field: F,
    value: AmSimulateConfig[K][F],
  ) => {
    setAmConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const parseInputNumber = (value: string, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  useEffect(() => {
    if (selectedProcessor !== "am-simulate") return;
    sendAmConfig(currentWorkletNode, amConfig);
  }, [amConfig, selectedProcessor, currentWorkletNode]);

  const startAudio = async () => {
    try {
      const processorConfig = processorOptions.find(
        (p) => p.value === selectedProcessor,
      )!;

      const audioContext = new AudioContext({
        latencyHint: "interactive",
        sampleRate: 48000,
      });
      audioContextRef.current = audioContext;

      if (!loadedProcessorsRef.current.has(processorConfig.name)) {
        await audioContext.audioWorklet.addModule(processorConfig.url);
        loadedProcessorsRef.current.add(processorConfig.name);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedInputId ? { exact: selectedInputId } : undefined,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        } as MediaTrackConstraints,
      });
      mediaStreamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const workletNode = new AudioWorkletNode(
        audioContext,
        processorConfig.name,
      );
      workletNodeRef.current = workletNode;
      setCurrentWorkletNode(workletNode);

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      if (processorConfig.value === "am-simulate") {
        sendAmConfig(workletNode, amConfig);
      }

      if (selectedOutputId && "setSinkId" in audioContext) {
        await (audioContext as any).setSinkId(selectedOutputId);
      }

      setIsRunning(true);
    } catch (err) {
      console.error("Failed to start audio:", err);
    }
  };

  const stopAudio = () => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    setCurrentWorkletNode(null);
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    loadedProcessorsRef.current.clear();
    setIsRunning(false);
  };

  const handleOutputChange = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    if (audioContextRef.current && "setSinkId" in audioContextRef.current) {
      try {
        await (audioContextRef.current as any).setSinkId(deviceId);
      } catch (err) {
        console.error("Failed to set output device:", err);
      }
    }
  };

  const handleProcessorChange = async (processorType: ProcessorType) => {
    setSelectedProcessor(processorType);

    if (isRunning && audioContextRef.current && sourceNodeRef.current) {
      try {
        const processorConfig = processorOptions.find(
          (p) => p.value === processorType,
        )!;
        const audioContext = audioContextRef.current;

        if (!loadedProcessorsRef.current.has(processorConfig.name)) {
          await audioContext.audioWorklet.addModule(processorConfig.url);
          loadedProcessorsRef.current.add(processorConfig.name);
        }

        if (workletNodeRef.current) {
          workletNodeRef.current.disconnect();
        }

        const newWorkletNode = new AudioWorkletNode(
          audioContext,
          processorConfig.name,
        );
        workletNodeRef.current = newWorkletNode;
        setCurrentWorkletNode(newWorkletNode);

        sourceNodeRef.current.disconnect();
        sourceNodeRef.current.connect(newWorkletNode);
        newWorkletNode.connect(audioContext.destination);

        if (processorType === "am-simulate") {
          sendAmConfig(newWorkletNode, amConfig);
        }
      } catch (err) {
        console.error("Failed to switch processor:", err);
      }
    }
  };

  return (
    <div className="app-container">
      <div className="control-panel">
        <div className="control-grid">
          <div className="control-group">
            <label className="control-label">Input Device</label>
            <select
              className="control-select"
              value={selectedInputId}
              onChange={(e) => setSelectedInputId(e.target.value)}
              disabled={isRunning}
            >
              {inputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">Output Device</label>
            <select
              className="control-select"
              value={selectedOutputId}
              onChange={(e) => handleOutputChange(e.target.value)}
            >
              {outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">Processor</label>
            <select
              className="control-select"
              value={selectedProcessor}
              onChange={(e) =>
                handleProcessorChange(e.target.value as ProcessorType)
              }
            >
              {processorOptions.map((processor) => (
                <option key={processor.value} value={processor.value}>
                  {processor.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="status-bar">
          {!isRunning ? (
            <button className="btn btn-start" onClick={startAudio}>
              Start
            </button>
          ) : (
            <button className="btn btn-stop" onClick={stopAudio}>
              Stop
            </button>
          )}
        </div>
      </div>

      {selectedProcessor === "am-simulate" && (
        <div className="main-content">
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
                        "lpf",
                        "q",
                        parseInputNumber(e.target.value, 0.1),
                      )
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
                      handleAmConfigChange(
                        "lpf",
                        "stages",
                        parseInt(e.target.value || "1", 10) || 1,
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
                  <label className="param-label">
                    Attack (carrier periods)
                  </label>
                  <input
                    className="param-input"
                    type="number"
                    step="0.1"
                    value={amConfig.detector.attackTime}
                    onChange={(e) =>
                      handleAmConfigChange(
                        "detector",
                        "attackTime",
                        parseInputNumber(e.target.value, 0.1),
                      )
                    }
                  />
                </div>
                <div className="param-item">
                  <label className="param-label">
                    Release (carrier periods)
                  </label>
                  <input
                    className="param-input"
                    type="number"
                    step="0.1"
                    value={amConfig.detector.releaseTime}
                    onChange={(e) =>
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
                      handleAmConfigChange(
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
              <div className="param-group-title">Noise</div>
              <div className="param-grid">
                <div className="param-item">
                  <label className="param-checkbox">
                    <input
                      type="checkbox"
                      checked={amConfig.noise.enabled}
                      onChange={(e) =>
                        handleAmConfigChange(
                          "noise",
                          "enabled",
                          e.target.checked,
                        )
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
                      handleAmConfigChange(
                        "noise",
                        "level",
                        parseInputNumber(e.target.value, 0),
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <Scope
            workletNode={currentWorkletNode}
            isRunning={isRunning}
            width={600}
            height={300}
          />
        </div>
      )}
    </div>
  );
}

export default App;
