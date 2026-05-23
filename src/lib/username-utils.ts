const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

export function normalizeUsernameKey(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

export function getUsernameValidationError(username: string): string | null {
  if (typeof username !== "string") {
    return "Username is required.";
  }

  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return "Username is required.";
  }

  if (normalized.startsWith("@")) {
    return "Remove the @ symbol. Use letters, numbers, dots, and underscores only.";
  }

  if (normalized.length < 3 || normalized.length > 20) {
    return "Username must be 3-20 characters.";
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "Use only letters, numbers, dots, and underscores.";
  }

  return null;
}
