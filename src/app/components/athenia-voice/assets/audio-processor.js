/**
 * AudioWorkletProcessor para captura de micrófono.
 * Buffer de 128 frames = 8ms a 16kHz.
 * Minimiza latencia de captura antes de enviar a Gemini.
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    // 128 samples a 16kHz = 8ms por chunk — balance entre latencia y overhead
    this._targetFrames = 128;
  }

  process(inputs) {
    const channel = inputs?.[0]?.[0];
    if (!channel || channel.length === 0) return true;

    // Acumular en buffer tipado (más eficiente que array)
    const combined = new Float32Array(this._buffer.length + channel.length);
    combined.set(this._buffer);
    combined.set(channel, this._buffer.length);
    this._buffer = combined;

    while (this._buffer.length >= this._targetFrames) {
      const chunk = this._buffer.slice(0, this._targetFrames);
      this._buffer = this._buffer.slice(this._targetFrames);

      // Convertir Float32 a Int16 antes de postMessage (evita conversión en main thread)
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 32768 : s * 32767;
      }

      // Transferir el buffer (zero-copy con Transferable)
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);