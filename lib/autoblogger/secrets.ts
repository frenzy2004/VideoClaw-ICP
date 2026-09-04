const SECRET_PATTERN_SOURCES = [
  String.raw`\bapify_api_[A-Za-z0-9_-]+\b`,
  String.raw`\bgithub_pat_[A-Za-z0-9_]+\b`,
  String.raw`\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b`,
  String.raw`\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b`,
  String.raw`\bgh[pousr]_[A-Za-z0-9]{16,}\b`,
  String.raw`\bAKIA[0-9A-Z]{16}\b`,
  String.raw`\b(?:APIFY(?:_API)?_(?:TOKEN|KEY)|API[_-]?KEY|TOKEN|SECRET|PASSWORD)\s*[:=]\s*["']?[A-Za-z0-9_./-]{12,}`,
  String.raw`\b(?:Bearer|Apikey)\s+[^\s"']+`,
];

function serializedValue(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  return JSON.stringify(value) ?? String(value);
}

export function containsSecretLikeValue(value: unknown): boolean {
  const serialized = serializedValue(value);
  return SECRET_PATTERN_SOURCES.some((source) => new RegExp(source, 'i').test(serialized));
}

export function redactSensitive(value: unknown, secrets: string[] = []): string {
  let redacted = serializedValue(value);
  for (const secret of secrets) {
    if (secret) redacted = redacted.replaceAll(secret, '[REDACTED]');
  }
  for (const source of SECRET_PATTERN_SOURCES) {
    redacted = redacted.replace(new RegExp(source, 'gi'), '[REDACTED]');
  }
  return redacted;
}
