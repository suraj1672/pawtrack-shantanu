import type { Dog, MedicalHistoryEntry, VitalHistory } from '@/types';

/** Offline/local fallback if Gemini is unavailable or API key is missing. */
export function generateDogAssistantReply(
  question: string,
  context: {
    dog?: Dog | null;
    history?: MedicalHistoryEntry[];
    vitals?: VitalHistory[];
    hasAlert?: boolean;
    alertMessage?: string | null;
  }
): string {
  const q = question.toLowerCase();
  const dogName = context.dog?.name || 'your dog';
  const history = context.history || [];
  const vitals = context.vitals || [];

  const historySummary =
    history.length > 0
      ? history
          .slice(0, 5)
          .map(h => `- ${h.title}${h.diagnosis ? ` (${h.diagnosis})` : ''}: ${h.description}`)
          .join('\n')
      : null;

  const latestVital = vitals.length ? vitals[vitals.length - 1] : null;

  if (context.hasAlert || context.alertMessage) {
    if (q.includes('alert') || q.includes('unwell') || q.includes('sick') || q.includes('help')) {
      return (
        `${dogName} currently has an active health alert` +
        (context.alertMessage ? `: ${context.alertMessage}.` : '.') +
        ` Please check vitals on the dashboard and contact a veterinarian if symptoms persist.` +
        (historySummary ? `\n\nRelevant medical history:\n${historySummary}` : '')
      );
    }
  }

  if (q.includes('temperature') || q.includes('fever') || q.includes('temp')) {
    const temp = latestVital?.temperature;
    return (
      `Normal canine body temperature is roughly 38.0–39.2°C. ` +
      (temp
        ? `Latest recorded temperature for ${dogName} is ${temp}°C. `
        : `No recent temperature history is stored yet for ${dogName}. `) +
      `Temperatures above ~39.5°C can indicate fever — seek veterinary care if it continues.` +
      (historySummary ? `\n\nMedical history context:\n${historySummary}` : '')
    );
  }

  if (q.includes('heart') || q.includes('pulse') || q.includes('bpm')) {
    const hr = latestVital?.heartRate;
    return (
      `Typical resting heart rate for dogs is about 60–120 bpm (varies by size/breed). ` +
      (hr
        ? `Latest recorded heart rate for ${dogName} is ${hr} bpm. `
        : `No recent heart-rate history is stored yet for ${dogName}. `) +
      `Sustained irregular or very high rates warrant a vet visit.` +
      (historySummary ? `\n\nMedical history context:\n${historySummary}` : '')
    );
  }

  if (q.includes('history') || q.includes('record') || q.includes('medical')) {
    if (historySummary) {
      return `Medical history knowledge for ${dogName}:\n${historySummary}`;
    }
    return `No previous medical history is stored for ${dogName} yet.`;
  }

  return (
    `Thanks for asking about "${question.trim()}". ` +
    `I'm your dog health assistant for ${dogName}. ` +
    `This is guidance only — always consult a veterinarian for diagnosis or treatment.` +
    (latestVital
      ? `\n\nLatest stored vitals: temp ${latestVital.temperature}°C, HR ${latestVital.heartRate} bpm.`
      : '')
  );
}
