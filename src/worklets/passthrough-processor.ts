class PassthroughProcessor extends AudioWorkletProcessor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0]
    const output = outputs[0]

    if (input && output) {
      for (let channel = 0; channel < output.length; channel++) {
        const inputChannel = input[channel] || input[0]
        const outputChannel = output[channel]

        if (inputChannel && outputChannel) {
          for (let i = 0; i < outputChannel.length; i++) {
            outputChannel[i] = inputChannel[i]
          }
        }
      }
    }

    return true
  }
}

registerProcessor('passthrough-processor', PassthroughProcessor)
