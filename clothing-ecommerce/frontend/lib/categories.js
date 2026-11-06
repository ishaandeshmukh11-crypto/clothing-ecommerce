/** Turns the flat category list from the API into main groups with their sub-categories. */
export function buildTree(categories = []) {
  const byParent = {};
  for (const c of categories) {
    const key = c.parent ? String(c.parent) : 'root';
    (byParent[key] = byParent[key] || []).push(c);
  }
  const sort = (list = []) => [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  return sort(byParent.root).map((c) => ({ ...c, children: sort(byParent[String(c._id)]) }));
}

export const categoryHref = (c) => `/shop?category=${c.slug}`;
