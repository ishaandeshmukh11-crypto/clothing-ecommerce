'use client';

import { api } from './api';

// Column names people actually type in Excel → our field names
const ALIASES = {
  sku: 'sku', code: 'sku', itemcode: 'sku', productcode: 'sku', stylecode: 'sku', styleno: 'sku',
  name: 'name', productname: 'name', title: 'name', itemname: 'name',
  category: 'category', maincategory: 'category', cat: 'category',
  subcategory: 'subcategory', subcat: 'subcategory', type: 'subcategory', producttype: 'subcategory',
  price: 'price', sellingprice: 'price', retailprice: 'price', sp: 'price', rate: 'price',
  mrp: 'mrp',
  wholesaleprice: 'wholesalePrice', wholesale: 'wholesalePrice', wsprice: 'wholesalePrice', bulkprice: 'wholesalePrice',
  moq: 'moq', minqty: 'moq', minimumorder: 'moq', minorderqty: 'moq',
  sizes: 'sizes', size: 'sizes', sizestock: 'sizes',
  stock: 'stock', qty: 'stock', quantity: 'stock', inventory: 'stock',
  colors: 'colors', color: 'colors', colour: 'colors', colours: 'colors',
  fabric: 'fabric', material: 'fabric',
  description: 'description', desc: 'description', details: 'description',
  tags: 'tags', keywords: 'tags',
  images: 'images', image: 'images', photos: 'images', photo: 'images', imagefiles: 'images',
  featured: 'featured', bestseller: 'featured',
  active: 'active', visible: 'active', show: 'active',
  care: 'care',
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Converts sheet rows (array of arrays, first row = headers) into product rows */
export function rowsFromTable(table) {
  const [header = [], ...body] = table;
  const cols = header.map((h) => ({ raw: String(h ?? '').trim(), key: ALIASES[norm(h)] }));
  return body
    .filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))
    .map((r) => {
      const row = { attributes: {} };
      cols.forEach((c, i) => {
        const v = r[i] === null || r[i] === undefined ? '' : String(r[i]).trim();
        if (!c.raw || v === '') return;
        if (c.key) row[c.key] = v;
        else row.attributes[c.raw] = v; // any other column (Sleeve, Length, Fit…) becomes a filter
      });
      return row;
    });
}

export async function parseSheetFile(file) {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/universal');
    return rowsFromTable(await readSheet(file));
  }
  const Papa = (await import('papaparse')).default;
  const text = await file.text();
  const { data } = Papa.parse(text.replace(/^﻿/, ''), { skipEmptyLines: true });
  return rowsFromTable(data);
}

/** "DR101_1.jpg", "DR101-back.jpg" → "dr101" (same as the server) */
export function groupKey(filename = '') {
  return String(filename)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[\s_-]*(\(\d+\)|\d{1,2}|front|back|side|detail|[a-d])$/i, '')
    .trim()
    .toLowerCase();
}

export function nameFromFilename(filename = '') {
  const name = String(filename)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\(\d+\)|\b(img|image|photo|dsc|pxl|whatsapp image)\b|\b\d+\b|\bat\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return name.replace(/[^a-z]/gi, '').length >= 3 ? name : '';
}

/** Finds the photos for a sheet row: by the "images" column, else by SKU prefix */
export function matchImages(row, files) {
  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]));
  if (row.images) {
    return String(row.images)
      .split(/[,|;\n]+/)
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean)
      .map((n) => byName.get(n) || [...byName.values()].find((f) => f.name.toLowerCase().replace(/\.[a-z0-9]+$/, '') === n.replace(/\.[a-z0-9]+$/, '')))
      .filter(Boolean);
  }
  if (row.sku) {
    const sku = String(row.sku).toLowerCase();
    return files.filter((f) => groupKey(f.name) === sku || f.name.toLowerCase().startsWith(`${sku}_`) || f.name.toLowerCase().startsWith(`${sku}-`));
  }
  return [];
}

/** Shrinks big phone photos (max 1600px, JPEG) before upload — much faster on mobile data */
async function compress(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

/** Uploads files in small batches; returns Map(file → url). onProgress(done, total) */
export async function uploadAll(files, onProgress) {
  const urls = new Map();
  const unique = [...new Set(files)];
  for (let i = 0; i < unique.length; i += 6) {
    const batch = unique.slice(i, i + 6);
    const form = new FormData();
    // eslint-disable-next-line no-await-in-loop
    const ready = await Promise.all(batch.map(compress));
    ready.forEach((f) => form.append('images', f));
    // eslint-disable-next-line no-await-in-loop
    const { urls: got } = await api('/upload', { method: 'POST', form });
    batch.forEach((f, j) => urls.set(f, got[j]));
    onProgress?.(Math.min(i + batch.length, unique.length), unique.length);
  }
  return urls;
}

/** Sends rows to the server in chunks of 100; returns merged results */
export async function importRows(rows, options, onProgress) {
  const all = { created: 0, updated: 0, skipped: 0, errors: 0, results: [] };
  for (let i = 0; i < rows.length; i += 100) {
    // eslint-disable-next-line no-await-in-loop
    const r = await api('/products/bulk', { method: 'POST', body: { rows: rows.slice(i, i + 100), options } });
    all.created += r.created;
    all.updated += r.updated;
    all.skipped += r.skipped;
    all.errors += r.errors;
    all.results.push(...r.results.map((x) => ({ ...x, row: x.row + i })));
    onProgress?.(Math.min(i + 100, rows.length), rows.length);
  }
  return all;
}

export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([`﻿${text}`], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const TEMPLATE = [
  ['sku', 'name', 'category', 'subcategory', 'price', 'mrp', 'wholesalePrice', 'moq', 'sizes', 'colors', 'fabric', 'Sleeve', 'Neck', 'Fit', 'Rise', 'Occasion', 'images', 'description'],
  ['TOP-101', 'Ribbed Bodyfit Top', 'Tops', 'Bodyfit Tops', '549', '899', '290', '12', 'XS:10, S:12, M:12, L:8', 'Black', 'Cotton Lycra', 'Sleeveless', 'Square', '', '', '', 'TOP-101_1.jpg, TOP-101_2.jpg', ''],
  ['DR-201', '', 'Dresses', 'Gowns', '3499', '5499', '2100', '3', 'S:5, M:5, L:5', 'Silver', 'Net', 'Spaghetti', '', '', '', 'Wedding', '', ''],
  ['PN-301', 'Korean Wide Leg Pants', 'Pants', 'Korean Pants', '899', '1399', '480', '10', '26:8, 28:10, 30:10, 32:6', 'Grey', 'Polyester', '', '', 'Wide leg', 'High rise', '', '', ''],
]
  .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
  .join('\n');
