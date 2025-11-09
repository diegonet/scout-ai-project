/**
 * Decodes a base64 string into a Uint8Array.
 * This is a necessary step to process the raw audio data from the API.
 * @param base64 The base64 encoded string.
 * @returns A Uint8Array of the decoded data.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer that the Web Audio API can play.
 * @param data The raw audio data as a Uint8Array.
 * @param ctx The AudioContext to use for decoding.
 * @param sampleRate The sample rate of the audio (24000 for the TTS model).
 * @param numChannels The number of audio channels (1 for mono).
 * @returns A promise that resolves with the decoded AudioBuffer.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // The raw data is 16-bit PCM, so we create a Int16Array view on the buffer.
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize the 16-bit integer samples to floating-point values between -1.0 and 1.0
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


/**
 * A robust audio player for handling raw PCM audio streams from the Gemini API.
 * It encapsulates the Web Audio API for clean, stateful playback control.
 */
class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private _isPlaying: boolean = false;
    private onPlaybackEnd: (() => void) | null = null;

    private getContext(): AudioContext {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        return this.audioContext;
    }

    /**
     * Plays audio from a base64 encoded string.
     * @param base64Audio The raw PCM audio data, base64 encoded.
     * @param onEnd A callback function to execute when playback finishes.
     */
    async play(base64Audio: string, onEnd?: () => void) {
        if (this._isPlaying) {
            this.stop();
        }

        const ctx = this.getContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, ctx, 24000, 1);

        this.sourceNode = ctx.createBufferSource();
        this.sourceNode.buffer = audioBuffer;
        this.sourceNode.connect(ctx.destination);
        
        this.onPlaybackEnd = onEnd || null;
        
        this.sourceNode.onended = () => {
            // This event fires on both natural end and manual `stop()`.
            // We only want to trigger the callback on natural end.
            if (this._isPlaying) {
              this._isPlaying = false;
              if (this.onPlaybackEnd) {
                  this.onPlaybackEnd();
              }
            }
        };

        this.sourceNode.start();
        this._isPlaying = true;
    }

    /**
     * Stops the currently playing audio.
     */
    stop() {
        if (this.sourceNode) {
            this._isPlaying = false; // Set state before stopping to prevent onended callback logic
            this.sourceNode.onended = null; // Detach listener
            try {
                this.sourceNode.stop();
            } catch (e) {
                // The AudioBufferSourceNode can only be stopped once.
                console.warn("Audio source could not be stopped:", e);
            } finally {
                this.sourceNode = null;
            }
        }
    }
    
    /**
     * Returns the current playback state.
     */
    get isPlaying(): boolean {
        return this._isPlaying;
    }

    /**
     * Closes the audio context to release resources. Call this when the player is no longer needed.
     */
    destroy() {
        this.stop();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Export a singleton instance of the AudioPlayer for the app to use.
export const audioPlayer = new AudioPlayer();