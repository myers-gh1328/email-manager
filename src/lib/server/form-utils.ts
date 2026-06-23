export function required(form: FormData, key: string) {
  const value = formText(form.get(key)).trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function text(form: FormData, key: string) {
  return formText(form.get(key)).trim();
}

export function formText(value: FormDataEntryValue | null | string | boolean) {
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  return '';
}

export function errorText(error: unknown, fallback = 'Something went wrong.') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

export function variablesFor(
  contact: { firstName: string; lastName: string },
  classSession: {
    courseName: string;
    startsOn: string;
    endsOn?: string;
    startTime?: string;
    location: string;
    locationAddress?: string;
    locationPhone?: string;
    locationWebsite?: string;
    locationParkingNotes?: string;
    locationMeetingInstructions?: string;
    locationNotes?: string;
    notes: string;
  },
  instructorName: string
) {
  const endsOn = classSession.endsOn || classSession.startsOn;
  const classDateRange = endsOn === classSession.startsOn ? classSession.startsOn : `${classSession.startsOn} - ${endsOn}`;
  return {
    firstName: contact.firstName,
    fullName: `${contact.firstName} ${contact.lastName}`.trim(),
    courseName: classSession.courseName,
    classDate: classSession.startsOn,
    classStartDate: classSession.startsOn,
    classEndDate: endsOn,
    classStartTime: classSession.startTime ?? '',
    classDateRange,
    classLocation: classSession.location,
    locationName: classSession.location,
    locationAddress: 'locationAddress' in classSession ? (classSession.locationAddress ?? '') : '',
    locationPhone: 'locationPhone' in classSession ? (classSession.locationPhone ?? '') : '',
    locationWebsite: 'locationWebsite' in classSession ? (classSession.locationWebsite ?? '') : '',
    locationParkingNotes: 'locationParkingNotes' in classSession ? (classSession.locationParkingNotes ?? '') : '',
    locationMeetingInstructions: 'locationMeetingInstructions' in classSession ? (classSession.locationMeetingInstructions ?? '') : '',
    locationNotes: 'locationNotes' in classSession ? (classSession.locationNotes ?? '') : '',
    classNotes: classSession.notes,
    instructorName
  };
}
