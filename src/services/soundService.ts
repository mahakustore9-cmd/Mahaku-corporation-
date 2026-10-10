/**
 * Audio Chime, Voice Synthesis (Hindi TTS), and Notification Engine
 * Guarantees voice alerts for student journey scans.
 */

let audioCtx: AudioContext | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Pre-cache voices when available
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

// Initialize or resume AudioContext on user interaction to bypass mobile autoplay restrictions
export function unlockAudio(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      // Play a tiny inaudible buffer to permanently prime iOS/Android audio pipeline
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(0);
        osc.stop(audioCtx.currentTime + 0.05);
      } catch {
        // ignore
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn('AudioContext initialization note:', err);
    return false;
  }
}

/**
 * Checks if browser push/system notification is granted
 */
export function isNotificationGranted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Requests browser push/system notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.warn('Notification permission error:', e);
    return 'denied';
  }
}

/**
 * Explicit one-tap enablement for parents on mobile devices
 */
export async function enableVoiceAndNotifications(): Promise<{
  notificationGranted: boolean;
  audioUnlocked: boolean;
}> {
  const audioUnlocked = unlockAudio();
  let notifPermission: NotificationPermission = 'default';

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      notifPermission = await Notification.requestPermission();
    } catch {
      notifPermission = 'denied';
    }
  }

  // Play confirmation chime
  await playAlertChime();

  // Voice confirmation in Hindi
  const confirmText =
    notifPermission === 'granted'
      ? 'सुरक्षा अलर्ट और वॉइस नोटिफिकेशन सक्रिय हो गया है।'
      : 'वॉइस अलर्ट सक्रिय हो गया है।';

  await speakAlertText(confirmText, 'hi');

  if (notifPermission === 'granted') {
    await showSystemNotification('सुरक्षा अलर्ट सक्रिय', 'लाइव वॉइस व सुरक्षा सूचनाएं अब आपके फोन पर बजेंगी।');
  }

  try {
    localStorage.setItem('suraksha_alerts_enabled_v1', 'true');
  } catch {
    // ignore
  }

  return {
    notificationGranted: notifPermission === 'granted',
    audioUnlocked,
  };
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
    try {
      window.speechSynthesis.cancel(); // clear previous queued utterances
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.94; // Measured rate for clarity
      utterance.pitch = 1.02;
      utterance.volume = 1.0;

      const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
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

      // Small 60ms timeout to avoid mobile speech cancellation bug
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          // ignore
        }
      }, 60);
    } catch {
      // speech synthesis error fallback
    }
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
