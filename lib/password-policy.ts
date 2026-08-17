export function passwordScore(password: string) {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (["password", "qwerty", "123456", "admin", "letmein"].some((word) => password.toLowerCase().includes(word))) {
    score = Math.max(0, score - 2);
  }
  return Math.min(4, score);
}
