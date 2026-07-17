import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TurndownService from 'turndown';
import { ImageBlock } from '../components/editor/ImageBlock.js';
import { DrawingBlock } from '../components/editor/DrawingBlock.js';

const EXTENSIONS = [StarterKit, Underline, TextStyle, Color, ImageBlock, DrawingBlock];

function safeFilename(title) {
  return (title || 'Untitled').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'Untitled';
}

// TipTap JSON -> clean HTML (drawings replaced by their exported PNG)
export function noteToHTML(content) {
  if (!content || !content.type) return '';
  let html;
  try {
    html = generateHTML(content, EXTENSIONS);
  } catch {
    return '';
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('div[data-type="drawingBlock"]').forEach(div => {
    const url = div.getAttribute('exporturl') || div.getAttribute('exportUrl');
    if (url) {
      const img = doc.createElement('img');
      img.src = url;
      const w = div.getAttribute('data-width');
      img.style.cssText = `width:${w || '100%'};max-width:100%;border-radius:6px;`;
      div.replaceWith(img);
    } else {
      div.remove();
    }
  });
  doc.querySelectorAll('img').forEach(img => { img.style.maxWidth = '100%'; });
  return doc.body.innerHTML;
}

export function noteToText(title, content) {
  const html = noteToHTML(content);
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:-9999px;top:0;width:700px;';
  el.innerHTML = html;
  document.body.appendChild(el);
  const body = el.innerText.trim();
  document.body.removeChild(el);
  return `${title || 'Untitled'}\n\n${body}`;
}

export function noteToMarkdown(title, content) {
  const html = noteToHTML(content);
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  const md = turndown.turndown(html);
  return `# ${title || 'Untitled'}\n\n${md}\n`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportTxt(title, content) {
  downloadBlob(new Blob([noteToText(title, content)], { type: 'text/plain;charset=utf-8' }), `${safeFilename(title)}.txt`);
}

export function exportMarkdown(title, content) {
  downloadBlob(new Blob([noteToMarkdown(title, content)], { type: 'text/markdown;charset=utf-8' }), `${safeFilename(title)}.md`);
}

const DOC_STYLES = `
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; line-height: 1.6; }
  h1.note-title { font-size: 26pt; margin-bottom: 4pt; }
  hr.title-rule { border: none; border-top: 1.5pt solid #7c6cff; margin-bottom: 14pt; }
  img { max-width: 100%; }
  blockquote { border-left: 3pt solid #7c6cff; margin-left: 0; padding-left: 12pt; color: #444; }
  pre { background: #f4f4f8; padding: 10pt; border-radius: 6pt; font-family: 'Courier New', monospace; }
  code { font-family: 'Courier New', monospace; }
`;

function buildDocument(title, content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title || 'Untitled'}</title><style>${DOC_STYLES}</style></head>
<body><h1 class="note-title">${title || 'Untitled'}</h1><hr class="title-rule">${noteToHTML(content)}</body></html>`;
}

// Word opens HTML saved with a .doc extension and preserves formatting/images
export function exportDoc(title, content) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">${buildDocument(title, content).replace(/^<!DOCTYPE html><html>/, '')}`;
  downloadBlob(new Blob(['﻿', html], { type: 'application/msword' }), `${safeFilename(title)}.doc`);
}

export async function exportPdf(title, content) {
  const { default: html2pdf } = await import('html2pdf.js');
  const el = document.createElement('div');
  el.innerHTML = buildDocument(title, content);
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:720px;background:#fff;padding:8px;';
  container.appendChild(el);
  document.body.appendChild(container);
  try {
    await html2pdf().set({
      margin: [12, 12, 14, 12],
      filename: `${safeFilename(title)}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    }).from(el).save();
  } finally {
    document.body.removeChild(container);
  }
}
