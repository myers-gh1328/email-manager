export interface VocabularyLabels {
  courseTypeLabel: string;
  courseTypePluralLabel: string;
  classSessionLabel: string;
  classSessionPluralLabel: string;
  studentLabel: string;
  studentPluralLabel: string;
  instructorLabel: string;
  instructorPluralLabel: string;
}

export const defaultVocabulary: VocabularyLabels = {
  courseTypeLabel: 'Course type',
  courseTypePluralLabel: 'Course types',
  classSessionLabel: 'Class session',
  classSessionPluralLabel: 'Class sessions',
  studentLabel: 'Student',
  studentPluralLabel: 'Students',
  instructorLabel: 'Instructor',
  instructorPluralLabel: 'Instructors'
};

export function normalizeVocabulary(values: Partial<Record<keyof VocabularyLabels, string>>): VocabularyLabels {
  const labels = { ...defaultVocabulary };
  for (const key of Object.keys(defaultVocabulary) as Array<keyof VocabularyLabels>) {
    const value = values[key]?.trim();
    if (value) labels[key] = value;
  }
  return labels;
}
