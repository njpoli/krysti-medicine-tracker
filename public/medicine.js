export const medicines = [
  {
    id: 'oxycodone',
    name: 'Oxycodone',
    dose: '1–2 tablets · 5–10 mg',
    doses: ['1 tablet (5 mg)', '2 tablets (10 mg)'],
    hours: 4,
    kind: 'Pain relief',
    instructions:
      'Every 4 hours to start. Wean as able. 1–2 weeks of pain medication. Call on a weekday during business hours if more is needed.',
  },
  {
    id: 'ibuprofen',
    name: 'Ibuprofen',
    dose: '800 mg',
    doses: ['800 mg', '600 mg', '400 mg', '200 mg'],
    hours: 6,
    days: 3,
    kind: 'Scheduled',
    instructions:
      'Every 6 hours for the first 3 days only. Stagger with Tylenol.',
  },
  {
    id: 'tylenol',
    name: 'Tylenol',
    dose: '1 tablet · 500 mg',
    doses: ['1 tablet (500 mg)'],
    hours: 6,
    days: 3,
    kind: 'Scheduled',
    instructions:
      'Every 6 hours for the first 3 days only. Stagger with ibuprofen.',
  },
  {
    id: 'gabapentin',
    name: 'Gabapentin',
    dose: '300 mg',
    doses: ['300 mg'],
    days: 3,
    kind: 'At night',
    instructions: 'At night, for the first 3 nights only.',
  },
  {
    id: 'aspirin',
    name: 'Aspirin',
    dose: '1 tablet · 325 mg',
    doses: ['1 tablet (325 mg)'],
    kind: 'Once daily',
    instructions: 'Once daily. No course end date was supplied.',
  },
  {
    id: 'zofran',
    name: 'Zofran',
    dose: '1 tablet · 4 mg',
    doses: ['1 tablet (4 mg)'],
    hours: 8,
    kind: 'As needed',
    instructions: 'Every 8 hours as needed for nausea.',
  },
  {
    id: 'calcium',
    name: 'Calcium',
    dose: 'Dosage unknown',
    doses: ['Dosage unknown'],
    kind: 'Once daily',
    instructions:
      'Once daily. Dosage and course duration have not been supplied.',
  },
  {
    id: 'vitamin-c',
    name: 'Vitamin C',
    dose: 'Dosage unknown',
    doses: ['Dosage unknown'],
    kind: 'Once daily',
    instructions:
      'Once daily. Dosage and course duration have not been supplied.',
  },
  {
    id: 'vitamin-d',
    name: 'Vitamin D',
    dose: 'Dosage unknown',
    doses: ['Dosage unknown'],
    kind: 'Once daily',
    instructions:
      'Once daily. Dosage and course duration have not been supplied.',
  },
  {
    id: 'miralax',
    name: 'MiraLAX',
    dose: 'Dose / schedule to confirm',
    doses: ['Dosage unknown', '17 g'],
    scheduleUnconfirmed: true,
    kind: 'Constipation support',
    instructions:
      'Doctor’s notes mention constipation from painkillers but do not specify a dose or schedule. Confirm these with the pharmacist or surgical team. General OTC label for ages 17+: 17 g dissolved in 4–8 fl oz of beverage once daily, for no more than 7 days unless directed by a doctor. This is label information, not a confirmed prescription. Record only the amount actually taken; use the note for other amounts.',
    source:
      'https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d69ce3d4-7ca4-4fe3-b49e-6655e48d6963',
  },
];
export function recoveryDay(start, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) return null;
  const [y, m, d] = start.split('-').map(Number);
  return (
    Math.floor(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
        Date.UTC(y, m - 1, d)) /
        86400000,
    ) + 1
  );
}
export function statusFor(med, entries, start, now = new Date()) {
  const last = entries
    .filter((e) => e.medicine === med.id)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const day = recoveryDay(start, now);
  if (med.scheduleUnconfirmed)
    return {
      last,
      label: 'Confirm dose and schedule with care team',
      tone: '',
    };
  if (!day || day < 1)
    return { last, label: 'Set recovery start date', tone: '' };
  if (med.days && day > med.days)
    return { last, label: 'Initial 3-day course ended', tone: 'ended' };
  if (!last) return { label: 'No dose recorded', tone: '' };
  if (!med.hours)
    return {
      last,
      label:
        med.id === 'gabapentin'
          ? 'Nightly · check today’s log'
          : 'Daily · check today’s log',
      tone: '',
    };
  const next = new Date(new Date(last.at).getTime() + med.hours * 3600000);
  const elapsed = next <= now;
  return {
    last,
    next,
    label: elapsed
      ? `${med.hours}-hour interval elapsed${med.id === 'zofran' ? ' · only if needed' : ''}`
      : `Interval ends ${next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
    tone: elapsed ? 'elapsed' : 'waiting',
  };
}
export function validateEntry(entry) {
  const med = medicines.find((m) => m.id === entry?.medicine);
  return Boolean(
    med &&
    med.doses.includes(entry.dose) &&
    typeof entry.at === 'string' &&
    Number.isFinite(Date.parse(entry.at)) &&
    Date.parse(entry.at) <= Date.now() + 60000 &&
    typeof entry.note === 'string' &&
    entry.note.length <= 500,
  );
}
