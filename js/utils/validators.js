export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateSenha(senha) {
  if (senha.length < 4) return 'A senha deve ter no mínimo 4 caracteres';
  return null;
}

export function validateMatricula(matricula) {
  if (!matricula || matricula.trim().length < 3) return 'Matrícula inválida';
  return null;
}

export function validateNome(nome) {
  if (!nome || nome.trim().length < 3) return 'Nome deve ter no mínimo 3 caracteres';
  return null;
}

export function validateLoginFields(email, senha) {
  const errors = [];
  if (!email) errors.push('Email é obrigatório');
  else if (!validateEmail(email)) errors.push('Email inválido');
  if (!senha) errors.push('Senha é obrigatória');
  return errors;
}

export function validateRegisterFields(nome, email, matricula, senha, confirmSenha) {
  const errors = [];
  const e1 = validateNome(nome);
  if (e1) errors.push(e1);
  if (!validateEmail(email)) errors.push('Email inválido');
  const e2 = validateMatricula(matricula);
  if (e2) errors.push(e2);
  const e3 = validateSenha(senha);
  if (e3) errors.push(e3);
  if (senha !== confirmSenha) errors.push('Senhas não conferem');
  return errors;
}
