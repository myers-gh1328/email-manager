export type TemplateVariables = Record<string, string | number | null | undefined>;

const variablePattern = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function renderTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(variablePattern, (_match, key: string) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}

export function findMissingVariables(template: string, variables: TemplateVariables): string[] {
  const missing = new Set<string>();

  for (const match of template.matchAll(variablePattern)) {
    const key = match[1];
    const value = variables[key];
    if (value == null || value === '') {
      missing.add(key);
    }
  }

  return [...missing].sort();
}

export function listTemplateVariables(template: string): string[] {
  return [...new Set([...template.matchAll(variablePattern)].map((match) => match[1]))].sort();
}
