import type { Dog, MedicalHistoryEntry, MedicalRecord, SensorReading, VitalHistory } from '@/types';
import { generateDogAssistantReply } from '@/lib/chatbotFallback';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type AssistantContext = {
  dog?: Dog | null;
  history?: MedicalHistoryEntry[];
  vitals?: VitalHistory[];
  records?: MedicalRecord[];
  liveReading?: SensorReading | null;
  hasAlert?: boolean;
  alertMessage?: string | null;
};

function buildContextBlock(ctx: AssistantContext): string {
  const lines: string[] = [];
  const dog = ctx.dog;

  if (dog) {
    lines.push('## Selected dog profile');
    lines.push(`- Name: ${dog.name}`);
    lines.push(`- Breed/species: ${dog.breed || dog.species || 'unknown'}`);
    lines.push(`- Age: ${dog.age || 'unknown'}`);
    lines.push(`- Weight: ${dog.weight || 'unknown'}`);
    lines.push(`- Device ID (collar): ${dog.deviceId}`);
    lines.push(`- Status: ${dog.status}`);
    lines.push(`- Has alert: ${dog.hasAlert ? 'yes' : 'no'}`);
    if (dog.alertMessage || ctx.alertMessage) {
      lines.push(`- Alert message: ${dog.alertMessage || ctx.alertMessage}`);
    }
  } else {
    lines.push('## Selected dog profile');
    lines.push('No specific dog selected — answer with general canine health guidance.');
  }

  const live = ctx.liveReading;
  if (live) {
    lines.push('');
    lines.push('## Live collar reading (from device telemetry, current values)');
    lines.push(`- Temperature (°C): ${live.bodyTempC ?? 'n/a'}`);
    lines.push(`- Heart rate (bpm): ${live.bpm ?? 'n/a'}`);
    lines.push(`- SpO₂ (%): ${live.spo2 ?? 'n/a'}`);
    lines.push(`- Latitude: ${live.lat ?? 'n/a'}`);
    lines.push(`- Longitude: ${live.lon ?? 'n/a'}`);
    lines.push(`- Activity: ${live.activity ?? 'n/a'}`);
    lines.push(`- Timestamp: ${live.timestamp ? new Date(Number(live.timestamp)).toISOString() : 'now'}`);
  }

  const vitals = ctx.vitals || [];
  if (vitals.length) {
    lines.push('');
    lines.push(`## Stored vital history (${vitals.length} readings, most recent last)`);
    vitals.slice(-40).forEach(v => {
      lines.push(
        `- ${v.timestamp.toISOString()} | temp ${v.temperature}°C | HR ${v.heartRate} bpm | activity ${v.activity}` +
          (v.spo2 != null ? ` | SpO₂ ${v.spo2}%` : '') +
          (v.latitude != null ? ` | lat ${v.latitude}` : '') +
          (v.longitude != null ? ` | lon ${v.longitude}` : '')
      );
    });
  } else {
    lines.push('');
    lines.push('## Stored vital history');
    lines.push('No vital history rows stored yet for this dog.');
  }

  const history = ctx.history || [];
  if (history.length) {
    lines.push('');
    lines.push('## Previous medical history (knowledge for AI)');
    history.forEach(h => {
      lines.push(
        `- [${h.category}] ${h.title}` +
          (h.diagnosis ? ` | diagnosis: ${h.diagnosis}` : '') +
          (h.treatment ? ` | treatment: ${h.treatment}` : '') +
          `: ${h.description}`
      );
    });
  }

  const records = ctx.records || [];
  if (records.length) {
    lines.push('');
    lines.push('## Medical records on file');
    records.slice(0, 20).forEach(r => {
      lines.push(`- [${r.type}] ${r.title} (${r.date.toISOString().slice(0, 10)}) ${r.notes || ''}`);
    });
  }

  return lines.join('\n');
}

const SYSTEM_INSTRUCTION = `You are SentriQ's specialized dog health assistant for NGO rescue dogs.
Use the provided dog profile, LIVE collar telemetry, and STORED vital/medical history as primary context.
Be practical, clear, and concise. Flag concerning vitals (e.g. abnormal temperature or heart rate).
This is informational guidance only — always recommend consulting a veterinarian for diagnosis or treatment.
Do not invent readings that are not in the context. If data is missing, say so.
Never mention internal vendor names (database providers, cloud vendors) in your replies.`;

export async function askDogAssistant(
  question: string,
  context: AssistantContext
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    return generateDogAssistantReply(question, context);
  }

  const contextBlock = buildContextBlock(context);
  const userPrompt = `${contextBlock}\n\n## User question\n${question.trim()}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini API error', res.status, errText);
      return generateDogAssistantReply(question, context);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('')
        .trim() || '';

    if (!text) {
      return generateDogAssistantReply(question, context);
    }
    return text;
  } catch (err) {
    console.error('Gemini request failed', err);
    return generateDogAssistantReply(question, context);
  }
}
