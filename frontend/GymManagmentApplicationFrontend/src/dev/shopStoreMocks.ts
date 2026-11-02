// Preview-mode answers for the store side of the shop (/api/shop). Return undefined to fall through.
// An in-memory gym catalog with a working cart, wishlist, addresses, coupons, quotes, orders and
// reviews, kept in module variables so the whole member flow can be clicked through. Resets on reload.

import type {
  ShopAddress, ShopAddressInput, ShopCart, ShopCategory, ShopFilters, ShopImage, ShopOrder, ShopOrderItem,
  ShopOrderStatus, ShopOrderSummary, ShopPaymentMethod, ShopProductCard, ShopProductDetail, ShopQuote, ShopReview,
  ShopSettings, ShopVariant, ShopDeliveryMethod,
} from '../features/shop/api/shop.types';
import { formatPrice } from '../features/shop/common/format';

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string, errors: string[] | null = null) => ({ success: false, message, data: null, errors });
const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const img = (id: string) => `https://images.unsplash.com/${id}?w=800&q=70&auto=format&fit=crop`;

// ── Store settings ───────────────────────────────────────────────────────

const SETTINGS: ShopSettings = {
  name: 'GymBro Store', tagline: 'Fuel, gear and kit for every session', currency: 'INR', taxRate: 0.18,
  freeShippingThreshold: 2999, standardShipping: 99, expressShipping: 249, standardDeliveryDays: 5, expressDeliveryDays: 2,
  returnDays: 7, supportEmail: 'shop@gymbro.example', supportPhone: '+91 98765 00000', address: 'Downtown branch, Mumbai',
  businessHours: 'Mon–Sat, 9am–8pm',
};

// ── Catalog ──────────────────────────────────────────────────────────────

interface Cat { id: number; name: string; slug: string; description: string; parentId: number | null; sortOrder: number }
const CATS: Cat[] = [
  { id: 1, name: 'Supplements', slug: 'supplements', description: 'Protein, performance and daily nutrition.', parentId: null, sortOrder: 1 },
  { id: 2, name: 'Apparel', slug: 'apparel', description: 'Sweat-wicking training wear.', parentId: null, sortOrder: 2 },
  { id: 3, name: 'Accessories', slug: 'accessories', description: 'Shakers, gloves and the small stuff.', parentId: null, sortOrder: 3 },
  { id: 4, name: 'Equipment', slug: 'equipment', description: 'Train at home with gym-grade kit.', parentId: null, sortOrder: 4 },
  { id: 11, name: 'Protein', slug: 'protein', description: 'Whey and plant protein for recovery.', parentId: 1, sortOrder: 1 },
  { id: 12, name: 'Performance', slug: 'performance', description: 'Pre-workout and creatine.', parentId: 1, sortOrder: 2 },
  { id: 13, name: 'Vitamins', slug: 'vitamins', description: 'Daily essentials.', parentId: 1, sortOrder: 3 },
  { id: 21, name: 'Tops', slug: 'tops', description: 'Tees and tanks.', parentId: 2, sortOrder: 1 },
  { id: 22, name: 'Bottoms', slug: 'bottoms', description: 'Joggers and shorts.', parentId: 2, sortOrder: 2 },
];

interface Prod {
  id: number; name: string; slug: string; brand: string; categoryId: number; short: string; description: string;
  specs: Record<string, string>; images: string[]; isNew: boolean; isFeatured: boolean; createdDaysAgo: number;
  variants: ShopVariant[];
}

let variantSeq = 100;
/** Builds variants from attribute lists; `price` gets the variant's attributes to vary price. */
function variants(skuBase: string, attrs: Partial<Record<'flavour' | 'size' | 'colour' | 'weight', string[]>>,
  price: (v: Partial<ShopVariant>) => number, compare: ((v: Partial<ShopVariant>) => number | null) | null, stock: (v: Partial<ShopVariant>, i: number) => number): ShopVariant[] {
  let combos: Partial<ShopVariant>[] = [{}];
  for (const [k, vals] of Object.entries(attrs)) combos = combos.flatMap(c => (vals ?? []).map(v => ({ ...c, [k]: v })));
  return combos.map((c, i) => {
    const s = stock(c, i);
    const name = [c.flavour, c.size, c.colour, c.weight].filter(Boolean).join(' / ') || 'Standard';
    return {
      id: ++variantSeq, sku: `${skuBase}-${i + 1}`, name, flavour: c.flavour ?? null, size: c.size ?? null, colour: c.colour ?? null,
      weight: c.weight ?? null, price: price(c), compareAtPrice: compare ? compare(c) : null, stock: s, inStock: s > 0, isDefault: i === 0,
    };
  });
}

const PRODUCTS: Prod[] = [
  {
    id: 1, name: 'Whey Isolate Protein', slug: 'whey-isolate-protein', brand: 'GymBro Nutrition', categoryId: 11,
    short: '27 g protein per scoop, low sugar, mixes clean.',
    description: 'Cold-filtered whey isolate with 27 g of protein and 6 g of BCAAs per scoop. Under 1 g sugar, no fillers, and it mixes smooth in water or milk. Take one scoop after training or between meals.',
    specs: { 'Protein per serving': '27 g', Servings: '33 (1 kg) / 66 (2 kg)', 'Sugar': '< 1 g', 'Made in': 'India', 'Lab tested': 'Yes' },
    images: [img('photo-1593095948071-474c5cc2989d'), img('photo-1579722821273-0f6c7d44362f'), img('photo-1622484212850-eb596d769edc')],
    isNew: false, isFeatured: true, createdDaysAgo: 120,
    variants: variants('WHEY', { flavour: ['Double Chocolate', 'Vanilla', 'Cookies & Cream'], size: ['1 kg', '2 kg'] },
      v => (v.size === '2 kg' ? 4299 : 2499), v => (v.size === '2 kg' ? 4999 : 2899), (v, i) => (v.flavour === 'Cookies & Cream' && v.size === '2 kg' ? 0 : 20 + i * 3)),
  },
  {
    id: 2, name: 'Ignite Pre-Workout', slug: 'ignite-pre-workout', brand: 'GymBro Nutrition', categoryId: 12,
    short: '200 mg caffeine, beta-alanine and citrulline for big sessions.',
    description: 'A clinically dosed pre-workout: 6 g citrulline malate, 3.2 g beta-alanine and 200 mg natural caffeine. Take 20 minutes before training. Not for under-18s.',
    specs: { Caffeine: '200 mg', Servings: '30', 'Citrulline malate': '6 g', 'Beta-alanine': '3.2 g' },
    images: [img('photo-1546483875-ad9014c88eba')], isNew: true, isFeatured: false, createdDaysAgo: 6,
    variants: variants('IGN', { flavour: ['Blue Raspberry', 'Watermelon'] }, () => 1899, () => 2199, (_v, i) => (i === 0 ? 3 : 12)),
  },
  {
    id: 3, name: 'Creatine Monohydrate', slug: 'creatine-monohydrate', brand: 'PureForm', categoryId: 12,
    short: 'Micronised, unflavoured, 5 g a day.',
    description: '100% micronised creatine monohydrate. Mixes into anything. 5 g a day supports strength and power output.',
    specs: { 'Per serving': '5 g', Flavour: 'Unflavoured' },
    images: [img('photo-1599058917765-a780eda07a3e')], isNew: false, isFeatured: true, createdDaysAgo: 200,
    variants: variants('CRE', { size: ['250 g', '500 g'] }, v => (v.size === '500 g' ? 1399 : 799), null, () => 40),
  },
  {
    id: 4, name: 'Daily Multivitamin', slug: 'daily-multivitamin', brand: 'PureForm', categoryId: 13,
    short: '23 vitamins and minerals for active people.',
    description: 'One tablet a day with breakfast. Covers vitamin D3, B12, zinc and magnesium — the ones training eats through.',
    specs: { Tablets: '60 / 120', Vegetarian: 'Yes' },
    images: [img('photo-1584308666744-24d5c474f2ae')], isNew: false, isFeatured: false, createdDaysAgo: 90,
    variants: variants('MULTI', { size: ['60 tablets', '120 tablets'] }, v => (v.size === '120 tablets' ? 1499 : 899), null, () => 55),
  },
  {
    id: 5, name: 'DryFit Training Tee', slug: 'dryfit-training-tee', brand: 'GymBro Wear', categoryId: 21,
    short: 'Light, quick-dry and cut for movement.',
    description: 'A breathable recycled-poly tee with flatlock seams that won’t rub under a barbell. Athletic fit — size up for a relaxed look.',
    specs: { Fabric: '88% recycled polyester, 12% elastane', Fit: 'Athletic', Care: 'Machine wash cold' },
    images: [img('photo-1521572163474-6864f9cf17ab'), img('photo-1583743814966-8936f5b7be1a')], isNew: true, isFeatured: true, createdDaysAgo: 10,
    variants: variants('TEE', { colour: ['Black', 'Olive', 'White'], size: ['S', 'M', 'L', 'XL'] }, () => 1299, () => 1599,
      (v, i) => (v.colour === 'White' && v.size === 'S' ? 0 : 8 + (i % 5))),
  },
  {
    id: 6, name: 'Flex Joggers', slug: 'flex-joggers', brand: 'GymBro Wear', categoryId: 22,
    short: 'Four-way stretch joggers with zip pockets.',
    description: 'Tapered joggers in a soft four-way stretch fabric. Zip pockets keep your phone and keys put during cardio.',
    specs: { Fabric: 'Nylon / elastane', Pockets: '2 zip, 1 back' },
    images: [img('photo-1552902865-b72c031ac5ea')], isNew: false, isFeatured: false, createdDaysAgo: 45,
    variants: variants('JOG', { colour: ['Black', 'Charcoal'], size: ['S', 'M', 'L', 'XL'] }, () => 2199, null, () => 10),
  },
  {
    id: 7, name: 'Steel Shaker 700 ml', slug: 'steel-shaker-700', brand: 'GymBro', categoryId: 3,
    short: 'Leak-proof stainless steel, keeps cold for hours.',
    description: 'Double-walled stainless steel shaker with a whisk ball and a leak-proof flip cap. No plastic taste, no smell.',
    specs: { Capacity: '700 ml', Material: 'Stainless steel', Dishwasher: 'Top rack' },
    images: [img('photo-1594882645126-14020914d58d')], isNew: false, isFeatured: true, createdDaysAgo: 150,
    variants: variants('SHK', { colour: ['Black', 'Lime'] }, () => 799, () => 999, () => 30),
  },
  {
    id: 8, name: 'Pro Lifting Gloves', slug: 'pro-lifting-gloves', brand: 'GymBro', categoryId: 3,
    short: 'Padded palms, wrist wrap support.',
    description: 'Padded leather palms and an integrated wrist wrap for pressing days.',
    specs: { Material: 'Leather / mesh' },
    images: [img('photo-1598289431512-b97b0917affc')], isNew: false, isFeatured: false, createdDaysAgo: 300,
    variants: variants('GLV', { size: ['S', 'M', 'L'] }, () => 999, null, () => 0),
  },
  {
    id: 9, name: 'Adjustable Dumbbell 24 kg', slug: 'adjustable-dumbbell-24', brand: 'IronCore', categoryId: 4,
    short: 'Fifteen dumbbells in one — 2.5 to 24 kg.',
    description: 'Turn the dial to switch from 2.5 kg to 24 kg in seconds. Compact, quiet and sold as a single dumbbell.',
    specs: { 'Weight range': '2.5 – 24 kg', Increments: '15 settings', Warranty: '2 years' },
    images: [img('photo-1583454110551-21f2fa2afe61'), img('photo-1517963879433-6ad2b056d712')], isNew: false, isFeatured: true, createdDaysAgo: 60,
    variants: variants('DB', {}, () => 18999, () => 21999, () => 4),
  },
  {
    id: 10, name: 'Resistance Band Set', slug: 'resistance-band-set', brand: 'IronCore', categoryId: 4,
    short: 'Five bands, handles, door anchor and bag.',
    description: 'Five stackable latex bands from 5 to 50 lb with handles, ankle straps and a door anchor.',
    specs: { Bands: '5 (5–50 lb)', Includes: 'Handles, straps, anchor, bag' },
    images: [], isNew: true, isFeatured: false, createdDaysAgo: 3,
    variants: variants('BAND', {}, () => 1499, null, () => 25),
  },
  {
    id: 11, name: 'Cast Iron Kettlebell', slug: 'cast-iron-kettlebell', brand: 'IronCore', categoryId: 4,
    short: 'Single-cast iron with a wide, smooth handle.',
    description: 'Single-piece cast iron with a flat base and a powder-coated handle for a sure grip.',
    specs: { Material: 'Cast iron', Finish: 'Powder coat' },
    images: [img('photo-1517344884509-a0c97ec11bcc')], isNew: false, isFeatured: false, createdDaysAgo: 80,
    variants: variants('KB', { weight: ['8 kg', '12 kg', '16 kg'] }, v => ({ '8 kg': 1999, '12 kg': 2799, '16 kg': 3599 })[v.weight as string] ?? 1999, null, (_v, i) => [12, 6, 2][i]),
  },
];

// ── Reviews ──────────────────────────────────────────────────────────────

let reviewSeq = 500;
let REVIEWS: ShopReview[] = [
  { id: ++reviewSeq, productId: 1, rating: 5, title: 'Best tasting whey I’ve had', comment: 'Double Chocolate mixes with just water and doesn’t clump. No bloating either.', authorName: 'Rohan D.', isVerifiedPurchase: true, createdAt: ago(12), isMine: false },
  { id: ++reviewSeq, productId: 1, rating: 4, title: 'Solid protein', comment: 'Vanilla is a bit sweet but great in oats. Will buy the 2 kg next time.', authorName: 'Meera N.', isVerifiedPurchase: true, createdAt: ago(25), isMine: false },
  { id: ++reviewSeq, productId: 1, rating: 5, title: null, comment: 'Clean label and lab tested. Recovery feels better.', authorName: 'Kabir S.', isVerifiedPurchase: false, createdAt: ago(31), isMine: false },
  { id: ++reviewSeq, productId: 1, rating: 3, title: 'Okay', comment: 'Good protein but the scoop was buried at the bottom.', authorName: 'Sara K.', isVerifiedPurchase: true, createdAt: ago(40), isMine: false },
  { id: ++reviewSeq, productId: 1, rating: 5, title: 'Repeat buyer', comment: 'Third tub. Cookies & Cream is dangerous.', authorName: 'Ananya I.', isVerifiedPurchase: true, createdAt: ago(55), isMine: false },
  { id: ++reviewSeq, productId: 1, rating: 4, title: 'Value for money', comment: 'Cheaper than imports and does the job.', authorName: 'Vikram P.', isVerifiedPurchase: true, createdAt: ago(70), isMine: false },
  { id: ++reviewSeq, productId: 5, rating: 5, title: 'Doesn’t cling', comment: 'Wore it for a sweaty leg day and it dried in minutes.', authorName: 'Meera N.', isVerifiedPurchase: true, createdAt: ago(4), isMine: false },
  { id: ++reviewSeq, productId: 5, rating: 4, title: 'Runs small', comment: 'Great fabric, size up if you like room in the shoulders.', authorName: 'Rohan D.', isVerifiedPurchase: true, createdAt: ago(8), isMine: false },
  { id: ++reviewSeq, productId: 7, rating: 5, title: 'No more smelly shakers', comment: 'Steel is the way. Keeps my shake cold through the whole session.', authorName: 'Aarav M.', isVerifiedPurchase: true, createdAt: ago(30), isMine: true },
  { id: ++reviewSeq, productId: 9, rating: 4, title: 'Saves space', comment: 'Dial is smooth. Wish it went to 30 kg.', authorName: 'Kabir S.', isVerifiedPurchase: true, createdAt: ago(15), isMine: false },
];

// ── Derived views ────────────────────────────────────────────────────────

const catById = (id: number) => CATS.find(c => c.id === id)!;
const subtree = (id: number): number[] => [id, ...CATS.filter(c => c.parentId === id).flatMap(c => subtree(c.id))];
const ratingOf = (pid: number) => {
  const rs = REVIEWS.filter(r => r.productId === pid);
  return { averageRating: rs.length ? r2(rs.reduce((n, r) => n + r.rating, 0) / rs.length) : 0, reviewCount: rs.length };
};
const defaultVariant = (p: Prod) => p.variants.find(v => v.isDefault && v.stock > 0) ?? p.variants.find(v => v.stock > 0) ?? p.variants[0];

function cardOf(p: Prod): ShopProductCard {
  p.variants.forEach(v => { v.inStock = v.stock > 0; });
  const d = defaultVariant(p);
  const inStock = p.variants.some(v => v.stock > 0);
  const cat = catById(p.categoryId);
  return {
    id: p.id, name: p.name, slug: p.slug, brand: p.brand, shortDescription: p.short, price: d.price, compareAtPrice: d.compareAtPrice,
    discountPercent: d.compareAtPrice && d.compareAtPrice > d.price ? Math.round((1 - d.price / d.compareAtPrice) * 100) : null,
    primaryImageUrl: p.images[0] ?? null, secondaryImageUrl: p.images[1] ?? null, categoryName: cat.name, categorySlug: cat.slug,
    ...ratingOf(p.id), inStock, isNew: p.isNew, isFeatured: p.isFeatured, defaultVariantId: inStock ? d.id : null,
  };
}

function detailOf(p: Prod): ShopProductDetail {
  const cat = catById(p.categoryId);
  const images: ShopImage[] = p.images.map((url, i) => ({ id: p.id * 10 + i, url, altText: p.name, sortOrder: i, isPrimary: i === 0 }));
  return { ...cardOf(p), sku: p.variants[0]?.sku.split('-')[0] ?? '', description: p.description, specifications: p.specs, images, variants: p.variants.map(v => ({ ...v })), category: { id: cat.id, name: cat.name, slug: cat.slug } };
}

function categoryOf(c: Cat): ShopCategory {
  const ids = subtree(c.id);
  return {
    id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: null, parentId: c.parentId, sortOrder: c.sortOrder,
    productCount: PRODUCTS.filter(p => ids.includes(p.categoryId)).length,
    children: CATS.filter(x => x.parentId === c.id).sort((a, b) => a.sortOrder - b.sortOrder).map(categoryOf),
  };
}

function paged<T>(items: T[], query: URLSearchParams, defSize = 12) {
  const pageSize = Math.max(1, Number(query.get('pageSize')) || defSize);
  const pageNumber = Math.max(1, Number(query.get('page')) || 1);
  return { items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), pageNumber, pageSize, totalRecords: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) };
}

const list = (q: URLSearchParams, k: string) => (q.get(k) ?? '').split(',').map(s => s.trim()).filter(Boolean);
const inCategory = (slug: string | null) => {
  if (!slug) return PRODUCTS;
  const c = CATS.find(x => x.slug === slug);
  if (!c) return [];
  const ids = subtree(c.id);
  return PRODUCTS.filter(p => ids.includes(p.categoryId));
};
const matches = (p: Prod, term: string) => {
  const t = term.toLowerCase();
  return [p.name, p.brand, p.short, catById(p.categoryId).name].some(s => s.toLowerCase().includes(t));
};

function searchProducts(q: URLSearchParams): ShopProductCard[] {
  const search = q.get('search')?.trim();
  const min = q.get('minPrice') ? Number(q.get('minPrice')) : null;
  const max = q.get('maxPrice') ? Number(q.get('maxPrice')) : null;
  const brands = list(q, 'brands'), flavours = list(q, 'flavours'), sizes = list(q, 'sizes'), colours = list(q, 'colours');
  let ps = inCategory(q.get('category'));
  if (search) ps = ps.filter(p => matches(p, search));
  if (brands.length) ps = ps.filter(p => brands.includes(p.brand));
  if (flavours.length) ps = ps.filter(p => p.variants.some(v => v.flavour && flavours.includes(v.flavour)));
  if (sizes.length) ps = ps.filter(p => p.variants.some(v => v.size && sizes.includes(v.size)));
  if (colours.length) ps = ps.filter(p => p.variants.some(v => v.colour && colours.includes(v.colour)));
  let cards = ps.map(cardOf);
  if (min !== null) cards = cards.filter(c => c.price >= min);
  if (max !== null) cards = cards.filter(c => c.price <= max);
  if (q.get('inStock') === 'true') cards = cards.filter(c => c.inStock);
  if (q.get('featured') === 'true') cards = cards.filter(c => c.isFeatured);
  if (q.get('isNew') === 'true') cards = cards.filter(c => c.isNew);
  const created = (id: number) => PRODUCTS.find(p => p.id === id)!.createdDaysAgo;
  const sorters: Record<string, (a: ShopProductCard, b: ShopProductCard) => number> = {
    featured: (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || Number(b.inStock) - Number(a.inStock) || a.id - b.id,
    newest: (a, b) => created(a.id) - created(b.id),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    rating: (a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return cards.sort(sorters[q.get('sort') ?? 'featured'] ?? sorters.featured);
}

function filtersFor(slug: string | null): ShopFilters {
  const ps = inCategory(slug);
  const uniq = (f: (v: ShopVariant) => string | null) => [...new Set(ps.flatMap(p => p.variants.map(f)).filter((x): x is string => !!x))];
  const prices = ps.map(p => cardOf(p).price);
  return {
    brands: [...new Set(ps.map(p => p.brand))].sort(), flavours: uniq(v => v.flavour), sizes: uniq(v => v.size), colours: uniq(v => v.colour),
    minPrice: prices.length ? Math.min(...prices) : 0, maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}

// ── Member state ─────────────────────────────────────────────────────────

const findVariant = (id: number) => {
  for (const p of PRODUCTS) { const v = p.variants.find(x => x.id === id); if (v) return { p, v }; }
  return null;
};

let wishlist: { id: number; productId: number; addedAt: string }[] = [{ id: 1, productId: 9, addedAt: ago(3) }, { id: 2, productId: 6, addedAt: ago(9) }];
let wishSeq = 10;

let cart: { id: number; variantId: number; quantity: number }[] = [
  { id: 1, variantId: PRODUCTS[0].variants[0].id, quantity: 1 },
  { id: 2, variantId: PRODUCTS[6].variants[1].id, quantity: 2 },
];
let cartSeq = 10;

function cartView(): ShopCart {
  cart = cart.filter(i => findVariant(i.variantId));
  const items = cart.map(i => {
    const { p, v } = findVariant(i.variantId)!;
    return {
      id: i.id, variantId: v.id, productId: p.id, productName: p.name, productSlug: p.slug, variantName: v.name,
      flavour: v.flavour, size: v.size, colour: v.colour, weight: v.weight, sku: v.sku, imageUrl: p.images[0] ?? null,
      unitPrice: v.price, compareAtPrice: v.compareAtPrice, quantity: i.quantity, lineTotal: r2(v.price * i.quantity), availableStock: v.stock,
    };
  });
  return { id: 1, items, itemCount: items.reduce((n, i) => n + i.quantity, 0), subtotal: r2(items.reduce((n, i) => n + i.lineTotal, 0)) };
}

let addressSeq = 10;
let addresses: ShopAddress[] = [
  { id: 1, label: 'Home', fullName: 'Aarav Mehta', phone: '9876543210', line1: '402, Sea Breeze Apartments, 14th Road', line2: 'Near Khar Gymkhana', city: 'Mumbai', state: 'Maharashtra', postalCode: '400052', country: 'India', isDefault: true },
  { id: 2, label: 'Work', fullName: 'Aarav Mehta', phone: '9876543210', line1: 'Level 6, One BKC, G Block', line2: 'Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', postalCode: '400051', country: 'India', isDefault: false },
];

const COUPONS: Record<string, { description: string; percent?: number; fixed?: number; min: number; max?: number }> = {
  WELCOME10: { description: '10% off your first order', percent: 10, min: 1500, max: 1000 },
  FLAT200: { description: '₹200 off orders over ₹999', fixed: 200, min: 999 },
};

function couponCheck(code: string, subtotal: number): { discount: number; description: string } | { error: string } {
  const c = COUPONS[code.trim().toUpperCase()];
  if (!c) return { error: `“${code}” isn’t a valid coupon code.` };
  if (subtotal < c.min) return { error: `Add ${formatPrice(c.min - subtotal)} more to use ${code.toUpperCase()} (minimum ${formatPrice(c.min)}).` };
  const raw = c.percent ? (subtotal * c.percent) / 100 : c.fixed ?? 0;
  return { discount: r2(Math.min(raw, c.max ?? raw)), description: c.description };
}

function quoteFor(method: ShopDeliveryMethod, code?: string | null): ShopQuote {
  const { subtotal } = cartView();
  let discount = 0;
  let couponCode: string | null = null;
  let couponMessage: string | null = null;
  if (code) {
    const res = couponCheck(code, subtotal);
    if ('error' in res) couponMessage = res.error;
    else { discount = res.discount; couponCode = code.toUpperCase(); }
  }
  const after = subtotal - discount;
  const shipping = method === 'Express' ? SETTINGS.expressShipping : after >= SETTINGS.freeShippingThreshold || subtotal === 0 ? 0 : SETTINGS.standardShipping;
  const tax = r2(after * SETTINGS.taxRate);
  return {
    subtotal, discount, shipping, tax, total: r2(after + shipping + tax), couponCode, couponMessage,
    estimatedDelivery: ahead(method === 'Express' ? SETTINGS.expressDeliveryDays : SETTINGS.standardDeliveryDays),
  };
}

// ── Orders ───────────────────────────────────────────────────────────────

const FLOW: ShopOrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'OutForDelivery', 'Delivered'];
const AT_KEY: Record<string, keyof ShopOrder> = {
  Confirmed: 'confirmedAt', Processing: 'processingAt', Shipped: 'shippedAt', OutForDelivery: 'outForDeliveryAt', Delivered: 'deliveredAt', Cancelled: 'cancelledAt',
};

function timelineOf(o: ShopOrder): ShopOrder['timeline'] {
  const at = (s: ShopOrderStatus) => (s === 'Pending' ? o.placedAt : (o[AT_KEY[s]] as string | null));
  if (o.status === 'Cancelled') {
    return [...FLOW.filter(s => at(s)).map(s => ({ status: s, at: at(s), completed: true })), { status: 'Cancelled', at: o.cancelledAt, completed: true }];
  }
  const idx = FLOW.indexOf(o.status);
  return FLOW.map((s, i) => ({ status: s, at: i <= idx ? at(s) : null, completed: i <= idx }));
}

let orderSeq = 2230;
const orderNo = (d: Date) => `GB-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${++orderSeq}`;

function makeOrder(lines: { variantId: number; quantity: number }[], address: ShopAddress, opts: {
  status: ShopOrderStatus; placedAt: string; method: ShopDeliveryMethod; payment: ShopPaymentMethod; coupon?: string | null; notes?: string | null; tracking?: string | null;
}): ShopOrder {
  const items: ShopOrderItem[] = lines.map((l, i) => {
    const { p, v } = findVariant(l.variantId)!;
    return { id: Date.now() % 100000 + i, productId: p.id, variantId: v.id, productName: p.name, productSlug: p.slug, variantName: v.name, sku: v.sku, imageUrl: p.images[0] ?? null, unitPrice: v.price, quantity: l.quantity, lineTotal: r2(v.price * l.quantity) };
  });
  const subtotal = r2(items.reduce((n, i) => n + i.lineTotal, 0));
  let discount = 0;
  if (opts.coupon) { const c = couponCheck(opts.coupon, subtotal); if (!('error' in c)) discount = c.discount; }
  const after = subtotal - discount;
  const shipping = opts.method === 'Express' ? SETTINGS.expressShipping : after >= SETTINGS.freeShippingThreshold ? 0 : SETTINGS.standardShipping;
  const tax = r2(after * SETTINGS.taxRate);
  const total = r2(after + shipping + tax);
  const placed = new Date(opts.placedAt);
  const step = (n: number) => new Date(placed.getTime() + n * 0.6 * DAY).toISOString();
  const idx = FLOW.indexOf(opts.status);
  const paid = opts.payment !== 'CashOnDelivery' || opts.status === 'Delivered';
  const { id: _id, label: _l, isDefault: _d, ...shippingAddress } = address;
  const o: ShopOrder = {
    id: orderSeq + 1, orderNumber: orderNo(placed), status: opts.status, subtotal, discount, shipping, tax, total,
    couponCode: discount ? opts.coupon!.toUpperCase() : null, deliveryMethod: opts.method, notes: opts.notes ?? null, trackingNumber: opts.tracking ?? null,
    placedAt: opts.placedAt, confirmedAt: idx >= 1 ? step(0.2) : null, processingAt: idx >= 2 ? step(1) : null, shippedAt: idx >= 3 ? step(2) : null,
    outForDeliveryAt: idx >= 4 ? step(4) : null, deliveredAt: idx >= 5 ? step(4.5) : null, cancelledAt: null,
    estimatedDelivery: new Date(placed.getTime() + (opts.method === 'Express' ? SETTINGS.expressDeliveryDays : SETTINGS.standardDeliveryDays) * DAY).toISOString(),
    shippingAddress,
    payment: { method: opts.payment, status: paid ? 'Paid' : 'Pending', amount: total, transactionReference: opts.payment === 'CashOnDelivery' ? null : `pay_${Math.random().toString(36).slice(2, 12)}`, paidAt: paid ? opts.placedAt : null },
    items, timeline: [], customerId: null, customerName: null, customerEmail: null, customerPhone: null,
  };
  o.timeline = timelineOf(o);
  return o;
}

let orders: ShopOrder[] = [
  makeOrder([{ variantId: PRODUCTS[4].variants[1].id, quantity: 2 }, { variantId: PRODUCTS[2].variants[0].id, quantity: 1 }], addresses[0],
    { status: 'Shipped', placedAt: ago(3, 4), method: 'Standard', payment: 'Upi', tracking: 'DLV7781203345IN', notes: 'Leave with the security desk' }),
  makeOrder([{ variantId: PRODUCTS[6].variants[0].id, quantity: 1 }, { variantId: PRODUCTS[0].variants[2].id, quantity: 1 }], addresses[0],
    { status: 'Delivered', placedAt: ago(38), method: 'Express', payment: 'CashOnDelivery', tracking: 'DLV7712093381IN' }),
];

const summaryOf = (o: ShopOrder): ShopOrderSummary => ({
  id: o.id, orderNumber: o.orderNumber, status: o.status, total: o.total, itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
  placedAt: o.placedAt, previewImages: o.items.map(i => i.imageUrl).filter((u): u is string => !!u), customerName: null, customerEmail: null,
});

// ── Router ───────────────────────────────────────────────────────────────

type Body = Record<string, unknown> | undefined;

export function shopStoreRoute(method: string, path: string, rawBody: unknown, query: URLSearchParams): unknown | undefined {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : undefined) as Body;
  const seg = path.split('/').filter(Boolean).slice(1); // drop 'shop'
  const [a, b, c, d] = seg;
  const get = method === 'get';

  // Store and catalog
  if (a === 'store' && get) return ok(SETTINGS);
  if (a === 'categories' && get) {
    if (!b) return ok(CATS.filter(x => x.parentId === null).sort((x, y) => x.sortOrder - y.sortOrder).map(categoryOf));
    const cat = CATS.find(x => x.slug === b);
    return cat ? ok(categoryOf(cat)) : fail('Category not found.');
  }
  if (a === 'products' && get) {
    if (!b) return ok(paged(searchProducts(query), query));
    if (b === 'filters') return ok(filtersFor(query.get('category')));
    if (b === 'suggest') {
      const q = (query.get('q') ?? '').trim();
      if (q.length < 2) return ok({ products: [], categories: [] });
      return ok({
        products: PRODUCTS.filter(p => matches(p, q)).slice(0, 5).map(cardOf),
        categories: CATS.filter(x => x.name.toLowerCase().includes(q.toLowerCase())).map(({ id, name, slug }) => ({ id, name, slug })),
      });
    }
    const p = PRODUCTS.find(x => x.slug === b);
    if (!p) return fail('Product not found.');
    if (c === 'related') {
      const same = PRODUCTS.filter(x => x.id !== p.id && (x.categoryId === p.categoryId || catById(x.categoryId).parentId === catById(p.categoryId).parentId));
      const rest = PRODUCTS.filter(x => x.id !== p.id && !same.includes(x));
      return ok([...same, ...rest].slice(0, 6).map(cardOf));
    }
    return ok(detailOf(p));
  }

  // Reviews
  if (a === 'reviews') {
    if (b === 'product' && get) {
      const pid = Number(c);
      const rs = REVIEWS.filter(r => r.productId === pid);
      if (d === 'summary') {
        const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        rs.forEach(r => { distribution[String(r.rating)]++; });
        return ok({ ...ratingOf(pid), distribution });
      }
      return ok(paged([...rs].sort((x, y) => Number(y.isMine) - Number(x.isMine) || y.createdAt.localeCompare(x.createdAt)), query, 5));
    }
    if (!b && method === 'post') {
      const pid = Number(body?.productId);
      const rating = Number(body?.rating);
      if (!PRODUCTS.some(p => p.id === pid)) return fail('Product not found.');
      if (!(rating >= 1 && rating <= 5)) return fail('Validation failed.', ['Rating: Choose 1 to 5 stars.']);
      if (REVIEWS.some(r => r.productId === pid && r.isMine)) return fail('You’ve already reviewed this product.');
      const verified = orders.some(o => o.status === 'Delivered' && o.items.some(i => i.productId === pid));
      const r: ShopReview = { id: ++reviewSeq, productId: pid, rating, title: String(body?.title ?? '').trim() || null, comment: String(body?.comment ?? '').trim() || null, authorName: 'Aarav M.', isVerifiedPurchase: verified, createdAt: new Date().toISOString(), isMine: true };
      REVIEWS = [r, ...REVIEWS];
      return ok(r);
    }
    if (b && method === 'delete') {
      const r = REVIEWS.find(x => x.id === Number(b));
      if (!r) return fail('Review not found.');
      if (!r.isMine) return fail('You can only delete your own review.');
      REVIEWS = REVIEWS.filter(x => x !== r);
      return ok(null);
    }
  }

  // Wishlist
  if (a === 'wishlist') {
    if (get) {
      return ok({ items: wishlist.filter(w => PRODUCTS.some(p => p.id === w.productId)).map(w => ({ ...w, product: cardOf(PRODUCTS.find(p => p.id === w.productId)!) })) });
    }
    if (method === 'post') {
      const pid = Number(body?.productId);
      if (!PRODUCTS.some(p => p.id === pid)) return fail('Product not found.');
      if (!wishlist.some(w => w.productId === pid)) wishlist = [{ id: ++wishSeq, productId: pid, addedAt: new Date().toISOString() }, ...wishlist];
      return ok(null);
    }
    if (method === 'delete' && b) { wishlist = wishlist.filter(w => w.productId !== Number(b)); return ok(null); }
  }

  // Cart
  if (a === 'cart') {
    if (!b && get) return ok(cartView());
    if (!b && method === 'delete') { cart = []; return ok(cartView()); }
    if (b === 'items' && !c && method === 'post') {
      const found = findVariant(Number(body?.variantId));
      const qty = Math.max(1, Number(body?.quantity) || 1);
      if (!found) return fail('That option is no longer available.');
      if (found.v.stock <= 0) return fail(`Sorry — ${found.p.name} (${found.v.name}) is sold out.`);
      const line = cart.find(i => i.variantId === found.v.id);
      const have = line?.quantity ?? 0;
      const next = Math.min(have + qty, found.v.stock, 99);
      if (next === have) return fail(`Only ${found.v.stock} in stock — they’re all in your cart already.`);
      if (line) line.quantity = next; else cart.push({ id: ++cartSeq, variantId: found.v.id, quantity: next });
      return ok(cartView());
    }
    if (b === 'items' && c) {
      const line = cart.find(i => i.id === Number(c));
      if (!line) return fail('That item isn’t in your cart any more.');
      if (method === 'delete') { cart = cart.filter(i => i !== line); return ok(cartView()); }
      if (method === 'patch') {
        const qty = Number(body?.quantity);
        const { v } = findVariant(line.variantId)!;
        if (qty < 1) { cart = cart.filter(i => i !== line); return ok(cartView()); }
        if (qty > v.stock) return fail(`Only ${v.stock} left in stock.`);
        line.quantity = Math.min(qty, 99);
        return ok(cartView());
      }
    }
  }

  // Coupons and checkout
  if (a === 'coupons' && b === 'validate' && method === 'post') {
    const code = String(body?.code ?? '').trim().toUpperCase();
    const res = couponCheck(code, Number(body?.subtotal) || cartView().subtotal);
    return 'error' in res ? fail(res.error) : ok({ code, description: res.description, discountAmount: res.discount });
  }
  if (a === 'orders' && b === 'quote' && method === 'post') {
    return ok(quoteFor(body?.deliveryMethod === 'Express' ? 'Express' : 'Standard', (body?.couponCode as string | undefined) ?? null));
  }
  if (a === 'orders' && !b && method === 'post') {
    const address = addresses.find(x => x.id === Number(body?.addressId));
    if (!address) return fail('Choose a delivery address.');
    const view = cartView();
    if (!view.items.length) return fail('Your cart is empty.');
    const short = view.items.filter(i => i.quantity > i.availableStock);
    if (short.length) return fail('Some items ran out of stock.', short.map(i => `${i.productName}: only ${i.availableStock} left`));
    const deliveryMethod = body?.deliveryMethod === 'Express' ? 'Express' : 'Standard';
    const payment = (['CashOnDelivery', 'Card', 'Upi'] as const).find(x => x === body?.paymentMethod) ?? 'CashOnDelivery';
    const notes = String(body?.notes ?? '').trim().slice(0, 500) || null;
    const order = makeOrder(cart.map(i => ({ variantId: i.variantId, quantity: i.quantity })), address, {
      status: payment === 'CashOnDelivery' ? 'Pending' : 'Confirmed', placedAt: new Date().toISOString(), method: deliveryMethod, payment,
      coupon: (body?.couponCode as string | undefined) ?? null, notes,
    });
    for (const i of cart) findVariant(i.variantId)!.v.stock -= i.quantity;
    cart = [];
    orders = [order, ...orders];
    return ok(order);
  }
  if (a === 'orders' && !b && get) return ok(paged(orders.map(summaryOf), query, 10));
  if (a === 'orders' && b && b !== 'quote') {
    const o = orders.find(x => x.orderNumber === decodeURIComponent(b));
    if (!o) return fail('Order not found.');
    if (!c && get) return ok(o);
    if (c === 'cancel' && method === 'post') {
      if (o.status !== 'Pending' && o.status !== 'Confirmed') return fail('This order is already being packed and can’t be cancelled. You can return it after delivery.');
      o.status = 'Cancelled';
      o.cancelledAt = new Date().toISOString();
      for (const i of o.items) { const f = findVariant(i.variantId); if (f) f.v.stock += i.quantity; }
      if (o.payment?.status === 'Paid') o.payment = { ...o.payment, status: 'Refunded' };
      o.timeline = timelineOf(o);
      return ok(o);
    }
  }

  // Addresses
  if (a === 'addresses') {
    const input = body as Partial<ShopAddressInput> | undefined;
    const check = (x?: Partial<ShopAddressInput>) => {
      const errs: string[] = [];
      if (!x?.fullName || x.fullName.trim().length < 2) errs.push('Full name: Enter the recipient’s full name.');
      if (!x?.phone || !/^[6-9]\d{9}$/.test(x.phone)) errs.push('Phone: Enter a 10-digit mobile number.');
      if (!x?.postalCode || !/^[1-9]\d{5}$/.test(x.postalCode)) errs.push('Postal code: Enter a 6-digit PIN code.');
      return errs;
    };
    const normalise = (x: Partial<ShopAddressInput>, id: number): ShopAddress => ({
      id, label: x.label ?? null, fullName: x.fullName ?? '', phone: x.phone ?? '', line1: x.line1 ?? '', line2: x.line2 ?? null,
      city: x.city ?? '', state: x.state ?? '', postalCode: x.postalCode ?? '', country: x.country ?? 'India', isDefault: !!x.isDefault,
    });
    const makeDefault = (id: number) => { addresses = addresses.map(x => ({ ...x, isDefault: x.id === id })); };

    if (!b && get) return ok([...addresses].sort((x, y) => Number(y.isDefault) - Number(x.isDefault) || x.id - y.id));
    if (!b && method === 'post') {
      const errs = check(input);
      if (errs.length) return fail('Please fix the highlighted fields.', errs);
      const addr = normalise(input!, ++addressSeq);
      addresses = [...addresses, addr];
      if (addr.isDefault || addresses.length === 1) makeDefault(addr.id);
      return ok(addresses.find(x => x.id === addr.id));
    }
    const id = Number(b);
    const existing = addresses.find(x => x.id === id);
    if (!existing) return fail('Address not found.');
    if (method === 'put') {
      const errs = check(input);
      if (errs.length) return fail('Please fix the highlighted fields.', errs);
      const addr = normalise(input!, id);
      addresses = addresses.map(x => (x.id === id ? { ...addr, isDefault: x.isDefault } : x));
      if (addr.isDefault) makeDefault(id);
      return ok(addresses.find(x => x.id === id));
    }
    if (method === 'patch' && c === 'default') { makeDefault(id); return ok(null); }
    if (method === 'delete') {
      addresses = addresses.filter(x => x.id !== id);
      if (existing.isDefault && addresses.length) makeDefault(addresses[0].id);
      return ok(null);
    }
  }

  return undefined;
}
