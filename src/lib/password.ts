/** Same rule as the backend: 8+ characters with an uppercase letter, a lowercase letter and a number. */
export const PASSWORD_HINT = 'At least 8 characters with an uppercase letter, a lowercase letter and a number.';

export function passwordIssue(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Password needs a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password needs an uppercase letter.';
  if (!/\d/.test(password)) return 'Password needs a number.';
  return null;
}
