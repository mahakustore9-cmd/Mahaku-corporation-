/**
 * Audio Chime, Voice Synthesis (Hindi TTS), and Notification Engine
 * Guarantees voice alerts for student journey scans.
 */

let audioCtx: AudioContext | null = null;

// Initialize or resume AudioContext on user interaction to bypass autoplay restrictions
export function unlockAudio(): void {
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (err) {
    console.warn('AudioContext initialization note:', err);
  }
}

/**
 * Plays a loud, pleasant 2-tone melodic notification chime before the voice message.
 */
export function playAlertChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      unlockAudio();
      if (!audioCtx) {
        resolve();
        return;
      }

      const now = audioCtx.currentTime;

      // Tone 1: High alert bell (880 Hz - A5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: Harmonious confirmation bell (1318.5 Hz - E6)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now + 0.15);
      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);

      setTimeout(resolve, 500);
    } catch {
      resolve();
    }
  });
}

/**
 * Speaks alert text aloud via Web Speech API with fallback settings (Hindi or English).
 */
export async function speakAlertText(text: string, lang: 'hi' | 'en' = 'hi'): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Play alert chime first
  await playAlertChime();

  // 2. Vibrate mobile device if supported
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // ignore
    }
  }

  // 3. Web Speech API SpeechSynthesis
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // clear previous queued utterances
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.94; // Measured rate for clarity
    utterance.pitch = 1.02;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (lang === 'hi') {
      const hindiVoice = voices.find(
        (v) => v.lang.startsWith('hi') || v.lang.includes('hi-IN') || v.name.toLowerCase().includes('hindi')
      );
      if (hindiVoice) {
        utterance.voice = hindiVoice;
        utterance.lang = hindiVoice.lang;
      } else {
        const indianVoice = voices.find((v) => v.lang.includes('en-IN') || v.name.toLowerCase().includes('india'));
        if (indianVoice) utterance.voice = indianVoice;
        utterance.lang = 'hi-IN';
      }
    } else {
      const enVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.lang.includes('IN') || v.lang.includes('US') || v.lang.includes('GB'))
      );
      if (enVoice) {
        utterance.voice = enVoice;
        utterance.lang = enVoice.lang;
      } else {
        utterance.lang = 'en-US';
      }
    }

    window.speechSynthesis.speak(utterance);
  }
}

/**
 * Backward compatibility alias for speakHindiText
 */
export async function speakHindiText(text: string): Promise<void> {
  return speakAlertText(text, 'hi');
}

/**
 * Requests browser notification permission and displays native notification.
 */
export async function showSystemNotification(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'suraksha-alert',
      });
    }
  } catch (err) {
    console.warn('Notification permission note:', err);
  }
}

export const NOTIFICATION_EVENT = 'SURAKSHA_SCAN_EVENT';

export function broadcastScanNotification(payload: {
  studentName: string;
  step: number;
  messageHi: string;
  studentId: string;
  time: string;
}) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: payload }));
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('suraksha_channel');
      channel.postMessage({ type: 'SCAN_EVENT', payload });
      channel.close();
    }
  } catch {
    // fallback
  }
}
