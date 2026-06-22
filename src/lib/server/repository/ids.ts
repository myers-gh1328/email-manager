export function newId() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}
