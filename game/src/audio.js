// A compact Web Audio synthesizer — every sound is generated at runtime, so the game needs no
// audio files and makes no network request. Audio starts on the first user gesture (the browser
// requires it). If Web Audio is unavailable the game simply plays silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let padGain = null;

  function ensure() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startPad();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function startPad() {
    // Two detuned low oscillators give a soft, evolving space drone.
    padGain = ctx.createGain();
    padGain.gain.value = 0.02;
    padGain.connect(master);
    [55, 55 * 1.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 1;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.03;
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = 6;
      lfo.connect(lfoAmt);
      lfoAmt.connect(osc.frequency);
      osc.connect(g);
      g.connect(padGain);
      osc.start();
      lfo.start();
    });
  }

  function tone(freq, dur, type, vol, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    const f0 = o.from ?? freq;
    osc.frequency.setValueAtTime(f0, t0);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    const attack = o.attack ?? 0.004;
    const release = o.release ?? 0.08;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filterType || 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (o.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  return {
    resume() {
      return ensure();
    },
    isMuted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    click() {
      if (!ensure() || muted) return;
      tone(980, 0.06, 'sine', 0.12, { to: 620 });
    },
    shot() {
      if (!ensure() || muted) return;
      tone(1500, 0.12, 'sawtooth', 0.06, { from: 2200, to: 900 });
      noise(0.06, 0.03, 5000, { filterType: 'highpass' });
    },
    explosion(mag) {
      if (!ensure() || muted) return;
      const m = Math.min(1, 0.5 + mag / 90);
      noise(0.5, 0.4 * m, 900, { to: 90 });
      tone(120, 0.4, 'sine', 0.25 * m, { from: 240, to: 50 });
    },
    pickup() {
      if (!ensure() || muted) return;
      tone(660, 0.09, 'sine', 0.16, { to: 990 });
      tone(990, 0.1, 'sine', 0.12, { delay: 0.06, to: 1320 });
    },
    hit() {
      if (!ensure() || muted) return;
      noise(0.35, 0.3, 1200, { to: 100 });
      tone(180, 0.35, 'square', 0.14, { from: 320, to: 60 });
    },
    comboUp(step) {
      if (!ensure() || muted) return;
      const f = 500 + step * 140;
      tone(f, 0.07, 'triangle', 0.1, { to: f * 1.4 });
    },
    warp() {
      if (!ensure() || muted) return;
      tone(220, 1.1, 'sawtooth', 0.1, { from: 160, to: 1400 });
      tone(440, 1.0, 'sine', 0.08, { delay: 0.05, from: 240, to: 2200 });
      noise(0.9, 0.06, 1200, { filterType: 'bandpass' });
    },
    over() {
      if (!ensure() || muted) return;
      [220, 175, 138, 110].forEach((f, i) => tone(f, 0.6, 'triangle', 0.12, { delay: i * 0.14 }));
      noise(1.2, 0.08, 500, { to: 60 });
    },
  };
}
