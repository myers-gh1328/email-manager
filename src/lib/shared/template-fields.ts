export const classTemplateTokens = [
  '{{firstName}}',
  '{{fullName}}',
  '{{courseName}}',
  '{{classDate}}',
  '{{classStartDate}}',
  '{{classEndDate}}',
  '{{classStartTime}}',
  '{{classDateRange}}',
  '{{classLocation}}',
  '{{locationName}}',
  '{{locationAddress}}',
  '{{locationPhone}}',
  '{{locationWebsite}}',
  '{{locationParkingNotes}}',
  '{{locationMeetingInstructions}}',
  '{{locationNotes}}',
  '{{classNotes}}',
  '{{instructorName}}'
] as const;

export const directEmailTokens = ['{{firstName}}', '{{fullName}}', '{{instructorName}}'] as const;

export function tokenFields(tokens: readonly string[]) {
  return tokens.map((token) => ({ token, label: token.replace(/[{}]/g, '') }));
}
