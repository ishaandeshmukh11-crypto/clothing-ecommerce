/**
 * Auto-writes product names, descriptions and tags so bulk uploads don't need
 * someone to type copy for every item. Template-based by default; if ANTHROPIC_API_KEY
 * is set, `aiDescription` can write a richer one.
 */

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const hash = (s = '') => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const lc = (s) => String(s || '').trim().toLowerCase();
/** "Dresses" → "Dress", "Tops" → "Top", but "Jeans" / "Pants" / "Shorts" stay plural */
function singular(word = '') {
  const w = String(word).trim();
  if (w.includes('&')) return w.split(/\s*&\s*/).map(singular).join(' & ');
  if (/(jeans|pants|shorts|trousers|leggings|joggers|denims|chinos)$/i.test(w)) return w;
  if (/(ss|sh|ch|x)es$/i.test(w)) return w.slice(0, -2);
  return w.replace(/s$/i, '');
}

const cap = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

/** "black-ribbed_crop top (2).JPG" → "Black Ribbed Crop Top" */
function nameFromFilename(filename = '') {
  const name = cap(
    String(filename)
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_\-.]+/g, ' ')
      .replace(/\(\d+\)|\b(img|image|photo|dsc|pxl|whatsapp image)\b|\b\d{3,}\b/gi, ' ')
      .replace(/\b\d+\b|\bat\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  // Camera/WhatsApp file names carry no real name — let the caller build one instead
  return name.replace(/[^a-z]/gi, '').length >= 3 ? name : '';
}

/** Groups photos like "DR101_1.jpg, DR101_2.jpg" into one product "DR101" */
function groupKeyFromFilename(filename = '') {
  return String(filename)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[\s_-]*(\(\d+\)|\d{1,2}|front|back|side|detail|[a-d])$/i, '')
    .trim()
    .toLowerCase();
}

const OPENERS = {
  tops: ['A wardrobe hero you will reach for again and again.', 'Easy to style, hard to take off.', 'Your new everyday favourite.'],
  dresses: ['Made to turn heads from day to night.', 'Effortless elegance in one easy piece.', 'The dress you will want for every occasion.'],
  pants: ['Comfort and polish in one perfect pair.', 'The pair that works as hard as you do.', 'Tailored to move with you.'],
  denims: ['Denim done right — built to last, made to fit.', 'Your go-to denim for every day.', 'Classic denim with a modern edge.'],
  shorts: ['Warm-weather essential with an easy fit.', 'Made for sunny days and easy weekends.', 'Laid-back style, all-day comfort.'],
  skirts: ['A feminine staple that pairs with everything.', 'Swish-worthy and endlessly versatile.', 'Elevate any look with this easy skirt.'],
  default: ['Thoughtfully designed for comfort and style.', 'A versatile piece for your wardrobe.', 'Style that fits right into your day.'],
};

const STYLING = {
  tops: ['Pair it with high-waist denims or a flowy skirt.', 'Tuck it into trousers for the office or wear it loose with shorts.', 'Layer it under a jacket for cooler evenings.'],
  dresses: ['Add sneakers for daytime or heels for a night out.', 'Finish with minimal jewellery and a sling bag.', 'Throw on a denim jacket for an easy casual look.'],
  pants: ['Pair with a fitted top or a tucked-in shirt.', 'Works with sneakers, loafers or heels.', 'Style with a crop top for a casual look or a blouse for work.'],
  denims: ['Pair with a basic tee, a crop top or an oversized shirt.', 'Dress it up with heels or keep it casual with sneakers.'],
  shorts: ['Pair with a crop top or an oversized tee.', 'Perfect with sneakers or sliders.'],
  skirts: ['Pair with a tucked-in top or a fitted bodysuit.', 'Style with sneakers by day and heels by night.'],
  default: ['Easy to pair with your favourite basics.'],
};

function typeKey(categoryPath = []) {
  const all = categoryPath.map(lc).join(' ');
  for (const k of ['tops', 'dresses', 'pants', 'denims', 'shorts', 'skirts']) {
    if (all.includes(k.slice(0, -1))) return k; // "top", "dresse"… also matches "dress"
  }
  if (all.includes('dress') || all.includes('gown')) return 'dresses';
  if (all.includes('jean')) return 'denims';
  return 'default';
}

/**
 * @param {{ name: string, categoryPath?: string[], attributes?: object, fabric?: string, colors?: {name:string}[] }} p
 */
function describeProduct(p) {
  const seed = hash(p.name);
  const type = typeKey(p.categoryPath);
  const attrs = Object.entries(p.attributes || {}).filter(([, v]) => v);
  const colour = p.colors?.map((c) => c.name).filter(Boolean).join(' / ');
  const leaf = p.categoryPath?.[p.categoryPath.length - 1];

  const details = [];
  if (leaf) details.push(`${singular(leaf)} style`);
  for (const [k, v] of attrs) if (/spaghetti/i.test(v)) details.push('spaghetti straps'); else if (/occasion/i.test(k)) details.push(`${lc(v)} wear`); else details.push(`${lc(v)}${/sleeve|length|fit|rise|neck|wash/i.test(k) && !lc(v).includes(lc(k)) ? ` ${lc(k)}` : ''}`);
  if (p.fabric) details.push(`${lc(p.fabric)} fabric`);
  if (colour) details.push(`in ${lc(colour)}`);

  const lines = [
    `${p.name}. ${pick(OPENERS[type], seed)}`,
    details.length ? `Features: ${details.join(', ')}.` : '',
    `${pick(STYLING[type], seed >> 3)}`,
    `Soft, breathable and finished with neat stitching for a comfortable all-day fit.`,
  ];
  return lines.filter(Boolean).join(' ');
}

function autoTags(p) {
  const words = [
    ...(p.categoryPath || []),
    ...Object.values(p.attributes || {}),
    ...(p.colors || []).map((c) => c.name),
    p.fabric,
  ];
  return [...new Set(words.filter(Boolean).map(lc))].slice(0, 20);
}

async function aiDescription(p) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 220,
        system: 'You write short, warm, accurate product descriptions for an Indian fashion store. 50-70 words, plain text, no emojis, no prices, no made-up claims about fabric or features that are not given.',
        messages: [{ role: 'user', content: `Product: ${p.name}\nCategory: ${(p.categoryPath || []).join(' > ')}\nDetails: ${JSON.stringify(p.attributes || {})}\nFabric: ${p.fabric || '-'}\nColours: ${(p.colors || []).map((c) => c.name).join(', ') || '-'}` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.find((c) => c.type === 'text')?.text?.trim() || null;
  } catch {
    return null;
  }
}

module.exports = { singular, describeProduct, autoTags, aiDescription, nameFromFilename, groupKeyFromFilename };
