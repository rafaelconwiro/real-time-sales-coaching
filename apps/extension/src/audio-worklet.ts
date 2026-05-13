/// <reference lib="webworker" />

// AudioWorkletProcessor that downsamples to a target rate and emits Float32 frames in fixed chunks.
// Loaded by AudioContext.audioWorklet.addModule(...) from offscreen.

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  port: MessagePort;
  constructor();
}
declare function registerProcessor(
  name: string,
  ctor: new (options?: any) => AudioWorkletProcessor,
): void;

interface PcmOptions {
  targetSampleRate: number;
  chunkSamples: number;
}

class Pcm16Downsampler extends AudioWorkletProcessor {
  private readonly targetRate: number;
  private readonly chunkSamples: number;
  private readonly ratio: number;
  private accumulator: number[] = [];

  constructor(options?: { processorOptions?: PcmOptions }) {
    super();
    const opts = options?.processorOptions ?? { targetSampleRate: 16000, chunkSamples: 1600 };
    this.targetRate = opts.targetSampleRate;
    this.chunkSamples = opts.chunkSamples;
    this.ratio = sampleRate / this.targetRate;
  }

  process(inputs: Float32Array[][]) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    // Linear downsample (simple, sufficient for speech).
    let idx = 0;
    while (idx < channel.length) {
      const srcIndex = idx;
      this.accumulator.push(channel[Math.floor(srcIndex)] ?? 0);
      idx += this.ratio;
      while (this.accumulator.length >= this.chunkSamples) {
        const chunk = this.accumulator.splice(0, this.chunkSamples);
        this.port.postMessage(new Float32Array(chunk));
      }
    }
    return true;
  }
}

registerProcessor("pcm16-downsampler", Pcm16Downsampler);
