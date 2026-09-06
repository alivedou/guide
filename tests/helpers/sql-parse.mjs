/**
 * Tiny SQL helpers for Phase 6: compare CREATE tables / statements without a full parser.
 */

export function stripSqlComments(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

export function extractStatements(sql) {
  const cleaned = stripSqlComments(sql);
  const parts = [];
  let buf = '';
  let quote = null;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (quote) {
      buf += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      buf += c;
      continue;
    }
    if (c === ';') {
      const stmt = buf.trim();
      if (stmt) parts.push(stmt);
      buf = '';
      continue;
    }
    buf += c;
  }
  const last = buf.trim();
  if (last) parts.push(last);
  return parts;
}

export function normalizeSql(sql) {
  return stripSqlComments(sql)
    .replace(/["`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function splitTopLevel(body) {
  const chunks = [];
  let buf = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      buf += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      buf += c;
      continue;
    }
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === ',' && depth === 0) {
      chunks.push(buf.trim());
      buf = '';
      continue;
    }
    buf += c;
  }
  const last = buf.trim();
  if (last) chunks.push(last);
  return chunks;
}

export function parseCreateTables(sql) {
  const tables = {};
  for (const stmt of extractStatements(sql)) {
    const m = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (!m) continue;
    const open = stmt.indexOf('(');
    const close = stmt.lastIndexOf(')');
    if (open < 0 || close < open) continue;
    const cols = [];
    for (const part of splitTopLevel(stmt.slice(open + 1, close))) {
      const first = part.trim().split(/\s+/)[0]?.replace(/["`]/g, '') || '';
      if (!first || /^(FOREIGN|PRIMARY|UNIQUE|CHECK|CONSTRAINT)$/i.test(first)) continue;
      cols.push(first.toLowerCase());
    }
    tables[m[1].toLowerCase()] = cols.sort();
  }
  return tables;
}

export function createStatementBodies(sql) {
  return extractStatements(sql).filter((s) => /^CREATE\s+/i.test(s));
}
