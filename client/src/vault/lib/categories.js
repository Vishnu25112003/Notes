// The four built-in categories live in code; custom ones are encrypted on the server.
// `standard` lists which of the common fields the category shows; `template` pre-fills custom fields on a new item.
export const BUILTIN_CATEGORIES = [
  {
    id: 'login', name: 'Login', icon: 'key', builtin: true,
    standard: ['url', 'username', 'password'],
    labels: { username: 'Username or email', password: 'Password' },
    template: [],
  },
  {
    id: 'card', name: 'Card / Bank', icon: 'card', builtin: true,
    standard: [],
    labels: {},
    template: [
      { name: 'Cardholder name', secret: false },
      { name: 'Card number', secret: true },
      { name: 'Expiry (MM/YY)', secret: false },
      { name: 'CVV', secret: true },
      { name: 'PIN', secret: true },
      { name: 'Bank / account no.', secret: true },
    ],
  },
  {
    id: 'wifi', name: 'Wi-Fi / Device', icon: 'wifi', builtin: true,
    standard: ['username', 'password', 'url'],
    labels: { username: 'Network name (SSID) or device user', password: 'Password or PIN', url: 'Admin page' },
    template: [{ name: 'Security (WPA2 / WPA3)', secret: false }],
  },
  {
    id: 'note', name: 'API key / Secure note', icon: 'code', builtin: true,
    standard: ['url'],
    labels: { url: 'Service URL' },
    template: [{ name: 'Key or token', secret: true }],
  },
];

export const CUSTOM_DEFAULTS = {
  standard: ['url', 'username', 'password'],
  labels: { username: 'Username', password: 'Password' },
};

export const CATEGORY_ICONS = ['tag', 'key', 'card', 'wifi', 'code', 'bank', 'mail', 'server', 'phone', 'shield', 'game', 'id'];

export function categoryById(id, custom = []) {
  const builtin = BUILTIN_CATEGORIES.find(c => c.id === id);
  if (builtin) return builtin;
  const c = custom.find(x => x.id === id);
  if (c) return { ...CUSTOM_DEFAULTS, ...c, builtin: false };
  return BUILTIN_CATEGORIES[3];
}

export const fieldLabel = (cat, field) =>
  cat.labels?.[field] || { url: 'Website', username: 'Username', password: 'Password' }[field];
