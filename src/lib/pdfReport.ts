import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import type { Dog, MedicalRecord, ReportPeriod, VitalHistory } from '@/types';

function periodLabel(period: ReportPeriod, from: Date, to: Date) {
  if (period === 'custom') {
    return `${format(from, 'PPP')} – ${format(to, 'PPP')}`;
  }
  return `${period.charAt(0).toUpperCase() + period.slice(1)} (${format(from, 'PPP')} – ${format(to, 'PPP')})`;
}

export function resolvePeriodRange(
  period: ReportPeriod,
  customFrom?: Date,
  customTo?: Date
): { from: Date; to: Date } {
  const to = customTo || new Date();
  const from = new Date(to);

  switch (period) {
    case 'daily':
      from.setDate(to.getDate() - 1);
      break;
    case 'weekly':
      from.setDate(to.getDate() - 7);
      break;
    case 'monthly':
      from.setMonth(to.getMonth() - 1);
      break;
    case 'yearly':
      from.setFullYear(to.getFullYear() - 1);
      break;
    case 'custom':
      return { from: customFrom || from, to };
  }

  return { from, to };
}

export function generateHealthReportPdf(options: {
  dog: Dog;
  ngoName: string;
  period: ReportPeriod;
  from: Date;
  to: Date;
  vitals: VitalHistory[];
  records?: MedicalRecord[];
}): Blob {
  const { dog, ngoName, period, from, to, vitals, records = [] } = options;
  const doc = new jsPDF();
  let y = 20;

  const line = (text: string, size = 11, gap = 7) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(size);
    doc.text(text, 14, y);
    y += gap;
  };

  doc.setFontSize(18);
  doc.text('SentriQ Health Report', 14, y);
  y += 10;

  line(`NGO: ${ngoName}`, 12);
  line(`Dog: ${dog.name} (${dog.breed || dog.species || 'Unknown breed'})`, 12);
  line(`Device ID: ${dog.deviceId}`, 11);
  line(`Age: ${dog.age || '—'}  |  Weight: ${dog.weight || '—'}`, 11);
  line(`Period: ${periodLabel(period, from, to)}`, 11);
  line(`Generated: ${format(new Date(), 'PPpp')}`, 10);
  y += 4;

  const temps = vitals.map(v => v.temperature).filter(n => Number.isFinite(n) && n > 0);
  const hrs = vitals.map(v => v.heartRate).filter(n => Number.isFinite(n) && n > 0);

  const avg = (arr: number[]) =>
    arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
  const min = (arr: number[]) => (arr.length ? Math.min(...arr) : null);
  const max = (arr: number[]) => (arr.length ? Math.max(...arr) : null);

  line('Vital Statistics', 14, 9);
  line(`Readings in period: ${vitals.length}`);
  line(
    `Temperature (°C): avg ${avg(temps) ?? '—'}  min ${min(temps) ?? '—'}  max ${max(temps) ?? '—'}`
  );
  line(`Heart rate (bpm): avg ${avg(hrs) ?? '—'}  min ${min(hrs) ?? '—'}  max ${max(hrs) ?? '—'}`);

  if (dog.hasAlert) {
    y += 2;
    line(`Active alert: ${dog.alertMessage || 'Health concern flagged'}`, 11);
  }

  y += 4;
  line('Recent Readings', 14, 9);
  const recent = vitals.slice(-15);
  if (!recent.length) {
    line('No vital readings stored for this period.');
  } else {
    recent.forEach(v => {
      line(
        `${format(v.timestamp, 'MMM d HH:mm')}  T ${v.temperature}°C  HR ${v.heartRate}  ${v.activity}`
      );
    });
  }

  if (records.length) {
    y += 4;
    line('Medical Records on File', 14, 9);
    records.slice(0, 20).forEach(r => {
      line(`${format(r.date, 'yyyy-MM-dd')}  [${r.type}] ${r.title}`);
    });
  }

  y += 6;
  line('Recommendations', 14, 9);
  line('• Monitor temperature and heart rate trends regularly.');
  line('• Follow up with a veterinarian for any critical alerts.');
  line('• Keep vaccination and prescription records up to date.');
  line('• This report is informational and not a veterinary diagnosis.');

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
