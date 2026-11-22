class SoundManager {
  private ctx: AudioContext | null = null;
  private musicGainNode: GainNode | null = null;
  private soundGainNode: GainNode | null = null;
  private isMusicPlaying = false;
  private shouldResumeMusic = false;
  private musicTimeoutId: number | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private visibilityListenerAttached = false;

  private ensureVisibilityListener() {
    if (this.visibilityListenerAttached || typeof document === 'undefined') return;
    this.visibilityListenerAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isMusicPlaying) {
          this.shouldResumeMusic = true;
          this.stopMusic();
        }
      } else if (this.shouldResumeMusic) {
        this.shouldResumeMusic = false;
        this.startMusic();
      }
    });
  }

  private initContext() {
    this.ensureVisibilityListener();
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.musicGainNode = this.ctx.createGain();
          this.soundGainNode = this.ctx.createGain();

          this.musicGainNode.gain.value = 0.15;
          this.soundGainNode.gain.value = 0.3;

          this.musicGainNode.connect(this.ctx.destination);
          this.soundGainNode.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore AudioContext restrictions in locked/sandboxed frames
    }
  }

  // Play sound effects
  public playSound(type: 'merge' | 'coin' | 'click' | 'upgrade' | 'order' | 'error', soundEnabled = true) {
    if (!soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx || !this.soundGainNode) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.soundGainNode);

      if (type === 'merge') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'coin') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'upgrade') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          if (!this.ctx || !this.soundGainNode) return;
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + idx * 0.06);
          g.connect(this.soundGainNode);
          o.connect(g);
          g.gain.setValueAtTime(0.2, now + idx * 0.06);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.06 + 0.3);
          o.start(now + idx * 0.06);
          o.stop(now + idx * 0.06 + 0.3);
        });
      } else if (type === 'order') {
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
          if (!this.ctx || !this.soundGainNode) return;
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + idx * 0.07);
          g.connect(this.soundGainNode);
          o.connect(g);
          g.gain.setValueAtTime(0.25, now + idx * 0.07);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.07 + 0.25);
          o.start(now + idx * 0.07);
          o.stop(now + idx * 0.07 + 0.25);
        });
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Ignore audio failures
    }
  }

  public setMusicEnabled(enabled: boolean) {
    if (enabled && !this.isMusicPlaying) {
      this.shouldResumeMusic = false;
      this.startMusic();
    } else if (!enabled) {
      this.shouldResumeMusic = false;
      this.stopMusic();
    }
  }

  private startMusic() {
    try {
      this.initContext();
      if (!this.ctx || !this.musicGainNode || this.isMusicPlaying) return;
      if (typeof document !== 'undefined' && document.hidden) {
        this.shouldResumeMusic = true;
        return;
      }

      this.isMusicPlaying = true;
      const notes = [261.63, 329.63, 392.0, 523.25];
      let step = 0;

      const playLoop = () => {
        if (!this.isMusicPlaying || !this.ctx || !this.musicGainNode) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[step % notes.length], now);

          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

          osc.connect(gain);
          gain.connect(this.musicGainNode);

          osc.start(now);
          osc.stop(now + 1.2);
        } catch {
          // Ignore single loop tick failure
        }

        step++;
        this.musicTimeoutId = window.setTimeout(playLoop, 800);
      };

      playLoop();
    } catch {
      // Ignore music startup failure
    }
  }

  private stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimeoutId !== null) {
      clearTimeout(this.musicTimeoutId);
      this.musicTimeoutId = null;
    }
    this.musicOscillators.forEach(o => {
      try {
        o.stop();
      } catch {
        // Ignore already stopped oscillators
      }
    });
    this.musicOscillators = [];
  }
}

export const soundManager = new SoundManager();
