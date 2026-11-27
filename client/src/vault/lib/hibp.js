// Have I Been Pwned "range" API with k-anonymity: only the first 5 hex characters of the SHA-1 leave the
// browser; the match against the returned suffixes happens here. Padding hides the real response size.
export async function breachCount(password) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password)));
  const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const prefix = hex.slice(0, 5);
  const suffix = hex.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!res.ok) throw new Error(`Breach check failed (${res.status})`);
  const body = await res.text();
  for (const line of body.split('\n')) {
    const [s, count] = line.trim().split(':');
    if (s === suffix) return Number(count) || 0;
  }
  return 0;
}
