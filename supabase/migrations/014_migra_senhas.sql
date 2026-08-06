-- SIEAC - Migration 014: converte hashes restantes para bcrypt
-- A Fase 0 já migrava a senha na hora do login (auth_login). Este passo garante
-- que QUALQUER valor que ainda não seja bcrypt vire bcrypt em lote, mesmo sem
-- o usuário logar. Valores que já começam com $2 (bcrypt) ficam intactos.

UPDATE usuarios
   SET senha_hash = crypt(senha_hash, gen_salt('bf', 10)),
       updated_at = NOW()
 WHERE senha_hash IS NOT NULL
   AND senha_hash NOT LIKE '$2%';

-- Auditoria: nenhum hash em texto puro deve sobrar.
-- SELECT id, email, senha_hash FROM usuarios WHERE senha_hash NOT LIKE '$2%';
