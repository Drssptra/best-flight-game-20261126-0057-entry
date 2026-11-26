// All sound is synthesised with WebAudio — no audio files. The engine is a
// pair of detuned oscillators through a low-pass filter, the wind is filtered
// noise, and the chimes, warnings and crash are short envelopes. Nothing
// starts until the first user gesture, as browsers require.
export function createAudio() {
  let context = null;
  let engine = null;
  let engineGain = null;
  let engineFilter = null;
  let wind = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      started = true;
    } catch {
      return false;
    }
    // Engine: two saws a fifth apart, muffled by a low-pass that opens with throttle.
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineFilter.Q.value = 1.2;
    engine = [55, 82.5].map((freq) => {
      const osc = context.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(engineFilter);
      osc.start();
      return osc;
    });
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    // Wind: a looped noise buffer through a band-pass that follows speed.
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    wind.start();
    return true;
  }

  function tone(freq, duration, type, volume, when = 0) {
    if (!context || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!context || muted) return;
    const t0 = context.currentTime;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(t0);
  }

  return {
    /** Call from a user gesture: unlocks the context and starts the engine loop. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Continuous engine and wind, called every frame with the plane's state. */
    update(throttle, speed, grounded) {
      if (!context || muted) return;
      const t = context.currentTime;
      const target = grounded ? 0.015 : 0.03 + throttle * 0.05;
      engineGain.gain.setTargetAtTime(target, t, 0.08);
      engineFilter.frequency.setTargetAtTime(240 + throttle * 900, t, 0.1);
      for (const osc of engine) osc.frequency.setTargetAtTime(48 + throttle * 62, t, 0.1);
      const windTarget = grounded ? 0 : Math.min(0.12, Math.max(0, (speed - 40) / 700));
      windGain.gain.setTargetAtTime(windTarget, t, 0.15);
      windFilter.frequency.setTargetAtTime(300 + speed * 6, t, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318.5, 0.5, 'sine', 0.18, 0.09);
    },
    land() {
      tone(523.25, 0.25, 'sine', 0.2);
      tone(659.25, 0.25, 'sine', 0.2, 0.12);
      tone(783.99, 0.45, 'sine', 0.2, 0.24);
    },
    level() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, 0.4, 'triangle', 0.2, i * 0.11));
    },
    crash() {
      noiseBurst(0.5, 0.5, 700);
      tone(70, 0.5, 'sine', 0.4);
    },
    warn() {
      tone(1046.5, 0.12, 'square', 0.07);
    },
  };
}
