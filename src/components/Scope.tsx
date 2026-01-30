import { useEffect, useRef } from "react";

interface ScopeProps {
  workletNode: AudioWorkletNode | null;
  isRunning: boolean;
  width?: number;
  height?: number;
}

const FFT_SIZE = 2048;
const SMOOTHING = 0;

export function Scope({ workletNode, isRunning, width = 600, height = 300 }: ScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const spectrumDataRef = useRef<Float32Array>(new Float32Array(FFT_SIZE / 2));
  const smoothedDataRef = useRef<Float32Array>(new Float32Array(FFT_SIZE / 2));

  // Handle incoming spectrum data from worklet
  useEffect(() => {
    if (!workletNode) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "spectrum") {
        const data = event.data.data as Float32Array;
        spectrumDataRef.current = data;
      }
    };

    workletNode.port.addEventListener("message", handleMessage);
    workletNode.port.start();

    // Request spectrum updates
    workletNode.port.postMessage({ type: "startSpectrum", fftSize: FFT_SIZE });

    return () => {
      workletNode.port.removeEventListener("message", handleMessage);
      workletNode.port.postMessage({ type: "stopSpectrum" });
    };
  }, [workletNode]);

  useEffect(() => {
    const drawSpectrum = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const spectrum = spectrumDataRef.current;
      const smoothed = smoothedDataRef.current;

      // Apply smoothing
      for (let i = 0; i < spectrum.length; i++) {
        smoothed[i] = SMOOTHING * smoothed[i] + (1 - SMOOTHING) * spectrum[i];
      }

      // Clear canvas
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = "#333355";
      ctx.lineWidth = 0.5;

      // Horizontal grid lines (dB levels)
      for (let db = 0; db >= -100; db -= 20) {
        const y = ((db + 100) / 100) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = "#666688";
        ctx.font = "10px monospace";
        ctx.fillText(`${db}dB`, 5, y - 2);
      }

      // Vertical grid lines (frequency)
      const freqLabels = [0, 6000, 12000, 18000, 24000];
      freqLabels.forEach((freq) => {
        const x = (freq / 24000) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });
      // Draw spectrum
      const binCount = smoothed.length;
      const barWidth = width / binCount;

      // Draw spectrum line on top
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let i = 0; i < binCount; i++) {
        const magnitude = smoothed[i];
        const db = magnitude > 0 ? 20 * Math.log10(magnitude) : -100;
        const normalizedDb = Math.max(0, (db + 100) / 100);
        const x = i * barWidth + barWidth / 2;
        const y = height - normalizedDb * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(drawSpectrum);
    };

    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(drawSpectrum);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, width, height]);

  return (
    <div className="scope-container">
      <div className="scope-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="scope-canvas"
        />
      </div>
    </div>
  );
}
