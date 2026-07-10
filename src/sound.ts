export type SoundEffect = "add" | "complete" | "delete";

const SOUND_STORAGE_KEY = "todo-horizons:sound-enabled";
const SILENCE = 0.0001;

let audioContext: AudioContext | null = null;

type Tone = {
  startFrequency: number;
  endFrequency: number;
  startsAt: number;
  duration: number;
  peakGain: number;
  oscillatorType: OscillatorType;
};

function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext();
  return audioContext;
}

function scheduleTone(context: AudioContext, tone: Tone): void {
  const startTime = context.currentTime + tone.startsAt;
  const endTime = startTime + tone.duration;
  const attackEnd = startTime + Math.min(0.012, tone.duration / 4);
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = tone.oscillatorType;
  oscillator.frequency.setValueAtTime(tone.startFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    tone.endFrequency,
    endTime,
  );

  gain.gain.setValueAtTime(SILENCE, startTime);
  gain.gain.exponentialRampToValueAtTime(tone.peakGain, attackEnd);
  gain.gain.exponentialRampToValueAtTime(SILENCE, endTime);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function scheduleEffect(context: AudioContext, effect: SoundEffect): void {
  switch (effect) {
    case "add":
      scheduleTone(context, {
        startFrequency: 440,
        endFrequency: 560,
        startsAt: 0,
        duration: 0.09,
        peakGain: 0.052,
        oscillatorType: "triangle",
      });
      return;
    case "complete":
      scheduleTone(context, {
        startFrequency: 523.25,
        endFrequency: 554.37,
        startsAt: 0,
        duration: 0.16,
        peakGain: 0.06,
        oscillatorType: "sine",
      });
      scheduleTone(context, {
        startFrequency: 659.25,
        endFrequency: 698.46,
        startsAt: 0.055,
        duration: 0.17,
        peakGain: 0.052,
        oscillatorType: "sine",
      });
      return;
    case "delete":
      scheduleTone(context, {
        startFrequency: 220,
        endFrequency: 150,
        startsAt: 0,
        duration: 0.12,
        peakGain: 0.045,
        oscillatorType: "triangle",
      });
  }
}

async function playEffect(effect: SoundEffect): Promise<void> {
  const context = getAudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  if (context.state === "running") {
    scheduleEffect(context, effect);
  }
}

export function playSound(effect: SoundEffect): void {
  void playEffect(effect).catch(() => {
    // Audio feedback must never interrupt the underlying task action.
  });
}

export function loadSoundEnabled(): boolean {
  try {
    const storedValue = localStorage.getItem(SOUND_STORAGE_KEY);

    if (storedValue === "false") {
      return false;
    }

    if (storedValue === "true") {
      return true;
    }
  } catch {
    // Fall back to enabled when storage is unavailable.
  }

  return true;
}

export function saveSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // Keep the selected preference for this session when storage is unavailable.
  }
}
