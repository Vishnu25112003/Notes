export function flattenTipTap(doc) {
  if (!doc || typeof doc !== 'object') return '';
  const parts = [];

  function walk(node) {
    if (!node) return;
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }

  walk(doc);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
