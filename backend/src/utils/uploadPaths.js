const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const backendRoot = path.resolve(__dirname, '..', '..');
const projectRoot = path.resolve(backendRoot, '..');

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

/**
 * Resolve os diretórios possíveis de upload local.
 *
 * Histórico do projeto:
 * - às vezes o backend é iniciado dentro de /backend
 * - às vezes a partir da raiz do repositório
 *
 * Quando UPLOAD_LOCAL_DIR é relativo (ex.: "uploads"), isso pode fazer
 * arquivos antigos existirem em locais diferentes. Por isso:
 * - escolhemos UM diretório canônico para novos uploads
 * - mas servimos também diretórios legados, para não quebrar anexos antigos
 */
function getUploadDirs() {
  const configured = env.UPLOAD_LOCAL_DIR || 'uploads';

  if (path.isAbsolute(configured)) {
    return [configured];
  }

  return unique([
    // diretório canônico para novos uploads
    path.resolve(backendRoot, configured),
    // compatibilidade com execuções feitas pela raiz do projeto
    path.resolve(projectRoot, configured),
    // compatibilidade com o diretório atual do processo
    path.resolve(process.cwd(), configured),
    // compatibilidade extra para cenários antigos/alternativos
    path.resolve(backendRoot, 'src', configured),
    path.resolve(projectRoot, 'backend', configured),
  ]);
}

function getPrimaryUploadDir() {
  return getUploadDirs()[0];
}

function ensurePrimaryUploadDir() {
  const dir = getPrimaryUploadDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function relativeFromUploadsUrl(url = '') {
  const normalized = String(url || '').replace(/\\/g, '/');
  const marker = '/uploads/';
  const idx = normalized.indexOf(marker);
  if (idx === -1) return null;
  return normalized.slice(idx + marker.length).replace(/^\/+/, '');
}

function findByBasename(name) {
  if (!name) return null;

  for (const root of getUploadDirs()) {
    if (!fs.existsSync(root)) continue;

    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile() && entry.name === name) {
          return full;
        }
      }
    }
  }

  return null;
}

function findExistingUploadFile(attOrPath) {
  const candidates = [];
  let fallbackName = '';

  if (typeof attOrPath === 'string') {
    candidates.push(attOrPath);
    fallbackName = path.basename(attOrPath);
  } else if (attOrPath && typeof attOrPath === 'object') {
    if (attOrPath.path) {
      candidates.push(attOrPath.path);
      fallbackName = path.basename(attOrPath.path);
    }

    const rel = relativeFromUploadsUrl(attOrPath.url);
    if (rel) {
      fallbackName = fallbackName || path.basename(rel);
      candidates.push(rel);
      for (const dir of getUploadDirs()) {
        candidates.push(path.join(dir, rel));
      }
    }

    fallbackName = fallbackName || path.basename(attOrPath.url || '') || path.basename(attOrPath.name || '');
  }

  for (const candidate of unique(candidates)) {
    if (!candidate) continue;

    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }

    for (const dir of getUploadDirs()) {
      const resolved = path.join(dir, candidate);
      if (fs.existsSync(resolved)) return resolved;
    }
  }

  return findByBasename(fallbackName);
}

module.exports = {
  getUploadDirs,
  getPrimaryUploadDir,
  ensurePrimaryUploadDir,
  findExistingUploadFile,
  relativeFromUploadsUrl,
};
