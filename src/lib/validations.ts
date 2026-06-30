// CPF Validation
export function validateCPF(cpf: string): boolean {
  // Remove non-digits
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1+$/.test(cleanCPF)) return false;
  
  // Validate first digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
  
  // Validate second digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
  
  return true;
}

// Format CPF for display
export function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, '');
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Sanitize phone input while user types
export function sanitizePhoneInput(phone: string): string {
  const trimmed = phone.replace(/[^\d+\s()-]/g, "");
  const hasLeadingPlus = trimmed.trim().startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (!digitsOnly) return hasLeadingPlus ? "+" : "";

  const limitedDigits = digitsOnly.slice(0, 15);
  return hasLeadingPlus ? `+${limitedDigits}` : limitedDigits;
}

// Normalize phone before saving in the database
export function normalizePhoneForStorage(phone: string): string {
  const hasLeadingPlus = phone.trim().startsWith("+");
  const digitsOnly = phone.replace(/\D/g, "").slice(0, 15);

  if (!digitsOnly) return "";
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

// Format phone for display
export function formatPhone(phone: string): string {
  const hasLeadingPlus = phone.trim().startsWith("+");
  const cleanPhone = phone.replace(/\D/g, '');

  if (cleanPhone.length === 11 && !hasLeadingPlus) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  if (cleanPhone.length === 10 && !hasLeadingPlus) {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  if (cleanPhone.length > 11 || hasLeadingPlus) {
    return `+${cleanPhone}`;
  }

  return phone;
}

// Validate phone number (national or international)
export function validatePhone(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 8 && cleanPhone.length <= 15;
}

// Validate email
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Format date for display (Brazilian format)
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}

// Format currency (BRL)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
