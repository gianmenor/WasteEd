export const passwordRequirementsMessage = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

export const validatePassword = (password) => {
  if (typeof password !== 'string') return false;
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\[\]{};:\'"\\|,.<>\/?~-]/.test(password);

  return password.length >= minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
};
