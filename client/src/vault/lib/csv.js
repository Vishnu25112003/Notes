// Small RFC 4180 CSV reader/writer: quoted fields, escaped quotes, CRLF, newlines inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  const s = text.replace(/^﻿/, '');
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    // A quote only opens a quoted field at its start; elsewhere it is a literal character
    if (c === '"' && field === '') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) || /^[=+\-@\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n';

// Recognises the exports of Chrome/Edge, Firefox and Bitwarden, and maps rows to vault items
export function detectAndMap(rows) {
  if (rows.length < 2) throw new Error('The file has no rows');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const idx = (name) => head.indexOf(name);
  const body = rows.slice(1).map(r => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ''])));
  const hostTitle = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || 'Imported login'; } };

  if (idx('login_password') >= 0 && idx('type') >= 0) {
    return {
      source: 'Bitwarden',
      items: body.map(r => {
        const fields = (r.fields || '').split('\n').filter(Boolean).map(line => {
          const k = line.indexOf(': ');
          return k > 0 ? { name: line.slice(0, k), value: line.slice(k + 2), secret: true } : { name: 'Field', value: line, secret: true };
        });
        return {
          categoryId: r.type === 'note' ? 'note' : r.type === 'card' ? 'card' : 'login',
          data: {
            title: r.name || hostTitle(r.login_uri), url: r.login_uri, username: r.login_username, password: r.login_password,
            notes: r.notes, favorite: r.favorite === '1' || r.favorite === 'true', fields,
          },
        };
      }),
    };
  }
  if (idx('httprealm') >= 0 || idx('timepasswordchanged') >= 0) {
    return {
      source: 'Firefox',
      items: body.map(r => ({
        categoryId: 'login',
        data: {
          title: hostTitle(r.url), url: r.url, username: r.username, password: r.password, notes: '', fields: [],
          passwordChangedAt: r.timepasswordchanged ? new Date(Number(r.timepasswordchanged)).toISOString() : undefined,
        },
      })),
    };
  }
  if (idx('url') >= 0 && idx('username') >= 0 && idx('password') >= 0) {
    return {
      source: idx('name') >= 0 ? 'Chrome / Edge' : 'CSV',
      items: body.map(r => ({
        categoryId: 'login',
        data: { title: r.name || hostTitle(r.url), url: r.url, username: r.username, password: r.password, notes: r.note || r.notes || '', fields: [] },
      })),
    };
  }
  throw new Error('Unrecognised CSV. Export from Chrome, Edge, Firefox or Bitwarden and try again.');
}
