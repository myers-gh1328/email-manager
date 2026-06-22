export function required(form: FormData, key: string) {
  const value = String(form.get(key) ?? '').trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function text(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
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
  const classDateRange = endsOn !== classSession.startsOn ? `${classSession.startsOn} - ${endsOn}` : classSession.startsOn;
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
