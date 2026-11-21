// Sound with no audio files: every effect is a small WebAudio oscillator, built when the
// player first interacts with the page (browsers refuse sound before that). A footstep's
// volume falls with distance, so the guards' steps tell you where they are. M mutes.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, now);
      if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + seconds);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + seconds + 0.02);
    } catch {
      // Sound is garnish: a failure here never stops the game.
    }
  }

  return {
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    play(kind, volume) {
      if (kind === 'step') {
        tone(90 + Math.random() * 30, 0.07, 'sine', 0.12 * (volume ?? 0.5));
      } else if (kind === 'alert') {
        tone(620, 0.16, 'square', 0.14, 880);
        setTimeout(() => tone(880, 0.22, 'square', 0.14, 620), 150);
      } else if (kind === 'pickup') {
        tone(880, 0.09, 'sine', 0.16);
        setTimeout(() => tone(1320, 0.12, 'sine', 0.14), 80);
      } else if (kind === 'coin') {
        tone(1560, 0.06, 'triangle', 0.14);
        setTimeout(() => tone(1170, 0.08, 'triangle', 0.12), 70);
      } else if (kind === 'relic') {
        tone(523, 0.12, 'sine', 0.16);
        setTimeout(() => tone(659, 0.12, 'sine', 0.16), 110);
        setTimeout(() => tone(784, 0.2, 'sine', 0.16), 220);
      } else if (kind === 'clear') {
        tone(523, 0.14, 'sine', 0.16);
        setTimeout(() => tone(659, 0.14, 'sine', 0.16), 130);
        setTimeout(() => tone(784, 0.14, 'sine', 0.16), 260);
        setTimeout(() => tone(1046, 0.28, 'sine', 0.16), 390);
      } else if (kind === 'caught') {
        tone(220, 0.3, 'sawtooth', 0.16, 110);
      }
    },
  };
}
