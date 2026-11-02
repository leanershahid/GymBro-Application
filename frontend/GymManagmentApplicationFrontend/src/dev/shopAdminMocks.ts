// Preview-mode answers for the admin side of the shop (/api/shop/admin). Return undefined to fall through.
// An in-memory gym catalogue, orders, customers and coupons, kept in module variables so edits stick while clicking.
import type {
  ShopAdminProduct, ShopAdminVariant, ShopCategory, ShopCoupon, ShopCustomerRow, ShopAddress, ShopImage,
  ShopInventoryRow, ShopOrder, ShopOrderStatus, ShopOrderSummary, ShopSettings, ShopAdminProductRow, ShopDashboard,
  ShopProductInput, ShopVariantInput, ShopCategoryInput, ShopCouponInput, ShopInventoryUpdate,
} from '../features/shop/api/shop.types';

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string, errors: string[] | null = null) => ({ success: false, message, data: null, errors });
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString();
const img = (seed: string) => `https://picsum.photos/seed/gb-${seed}/480/480`;
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let nextId = 1000;
const newId = () => ++nextId;

// ── Settings ────────────────────────────────────────────────────────────

let settings: ShopSettings = {
  name: 'GymBro Store', tagline: 'Fuel, gear and kit for every session', currency: 'INR', taxRate: 0.18,
  freeShippingThreshold: 1999, standardShipping: 99, expressShipping: 249, standardDeliveryDays: 5, expressDeliveryDays: 2,
  returnDays: 7, orderPrefix: 'GB', supportEmail: 'shop@gymbro.example', supportPhone: '+91 98765 00000',
  address: 'GymBro Downtown, 12 Marine Drive, Mumbai 400002', businessHours: 'Mon–Sat, 6am–10pm',
};

// ── Categories ──────────────────────────────────────────────────────────

interface Cat { id: number; name: string; slug: string; description: string | null; imageUrl: string | null; parentId: number | null; sortOrder: number; isActive: boolean }
let categories: Cat[] = [
  { id: 1, name: 'Supplements', slug: 'supplements', description: 'Protein, pre-workout and recovery.', imageUrl: img('supplements'), parentId: null, sortOrder: 1, isActive: true },
  { id: 2, name: 'Apparel', slug: 'apparel', description: 'Training wear.', imageUrl: img('apparel'), parentId: null, sortOrder: 2, isActive: true },
  { id: 3, name: 'Accessories', slug: 'accessories', description: 'Shakers, straps, belts.', imageUrl: img('accessories'), parentId: null, sortOrder: 3, isActive: true },
  { id: 4, name: 'Equipment', slug: 'equipment', description: 'Home training gear.', imageUrl: img('equipment'), parentId: null, sortOrder: 4, isActive: true },
  { id: 5, name: 'Protein', slug: 'protein', description: null, imageUrl: null, parentId: 1, sortOrder: 1, isActive: true },
  { id: 6, name: 'Pre-workout', slug: 'pre-workout', description: null, imageUrl: null, parentId: 1, sortOrder: 2, isActive: true },
  { id: 7, name: 'Recovery', slug: 'recovery', description: null, imageUrl: null, parentId: 1, sortOrder: 3, isActive: false },
];

// ── Products ────────────────────────────────────────────────────────────

type V = Omit<ShopAdminVariant, 'stock' | 'inStock'>;
interface Prod extends Omit<ShopAdminProduct, 'variants'> { variants: V[] }

const variant = (sku: string, name: string, price: number, onHand: number, extra: Partial<V> = {}): V => ({
  id: newId(), sku, name, flavour: null, size: null, colour: null, weight: null, price, compareAtPrice: null,
  isDefault: false, isActive: true, quantityOnHand: onHand, reservedQuantity: 0, lowStockThreshold: 5, ...extra,
});

const images = (...seeds: string[]): ShopImage[] =>
  seeds.map((s, i) => ({ id: newId(), url: img(s), altText: null, sortOrder: i, isPrimary: i === 0 }));

function product(id: number, p: Partial<Prod> & Pick<Prod, 'name' | 'sku' | 'basePrice' | 'categoryId' | 'variants'>): Prod {
  const v = p.variants;
  if (!v.some(x => x.isDefault) && v[0]) v[0].isDefault = true;
  return {
    id, slug: slugify(p.name), shortDescription: null, description: null, brand: null, compareAtPrice: null,
    isActive: true, isFeatured: false, isNew: false, specifications: {}, images: [], createdAt: daysAgo(60), updatedAt: daysAgo(id % 9),
    ...p,
  };
}

let products: Prod[] = [
  product(1, {
    name: 'Whey Protein Isolate', sku: 'GB-WPI', brand: 'GymBro Nutrition', basePrice: 3499, compareAtPrice: 3999, categoryId: 5, isFeatured: true,
    shortDescription: '27 g fast-absorbing protein per scoop, low in fat and sugar.',
    description: 'Cold-filtered whey isolate for lean muscle and quick recovery. Mixes smooth with water or milk.',
    specifications: { 'Serving size': '30 g', 'Protein per serving': '27 g', Servings: '33' },
    images: images('whey', 'whey2'),
    variants: [
      variant('GB-WPI-CHO-1', 'Chocolate · 1 kg', 3499, 42, { flavour: 'Chocolate', weight: '1 kg', compareAtPrice: 3999, isDefault: true, reservedQuantity: 3 }),
      variant('GB-WPI-VAN-1', 'Vanilla · 1 kg', 3499, 4, { flavour: 'Vanilla', weight: '1 kg', compareAtPrice: 3999 }),
      variant('GB-WPI-CHO-2', 'Chocolate · 2 kg', 6299, 15, { flavour: 'Chocolate', weight: '2 kg', reservedQuantity: 1 }),
    ],
  }),
  product(2, {
    name: 'Creatine Monohydrate', sku: 'GB-CRE', brand: 'GymBro Nutrition', basePrice: 999, categoryId: 1, isFeatured: true,
    shortDescription: 'Micronised creatine for strength and power.', specifications: { 'Serving size': '3 g', Servings: '83' },
    images: images('creatine'),
    variants: [variant('GB-CRE-250', 'Unflavoured · 250 g', 999, 60, { weight: '250 g', reservedQuantity: 2 })],
  }),
  product(3, {
    name: 'Pre-Workout Ignite', sku: 'GB-PRE', brand: 'Ignite Labs', basePrice: 1899, compareAtPrice: 2199, categoryId: 6, isNew: true,
    shortDescription: 'Caffeine, beta-alanine and citrulline for big sessions.', images: images('preworkout'),
    variants: [
      variant('GB-PRE-FP', 'Fruit Punch · 30 servings', 1899, 0, { flavour: 'Fruit Punch', compareAtPrice: 2199 }),
      variant('GB-PRE-BR', 'Blue Raspberry · 30 servings', 1899, 9, { flavour: 'Blue Raspberry', reservedQuantity: 1 }),
    ],
  }),
  product(4, {
    name: 'BCAA Recovery', sku: 'GB-BCAA', brand: 'GymBro Nutrition', basePrice: 1299, categoryId: 7, isActive: false,
    images: images('bcaa'), variants: [variant('GB-BCAA-WM', 'Watermelon · 300 g', 1299, 3, { flavour: 'Watermelon', weight: '300 g' })],
  }),
  product(5, {
    name: 'Dri-Fit Training Tee', sku: 'GB-TEE', brand: 'GymBro', basePrice: 799, compareAtPrice: 999, categoryId: 2, isNew: true,
    specifications: { Material: '88% polyester, 12% elastane' }, images: images('tee', 'tee2'),
    variants: [
      variant('GB-TEE-BLK-S', 'Black · S', 799, 12, { colour: 'Black', size: 'S', compareAtPrice: 999 }),
      variant('GB-TEE-BLK-M', 'Black · M', 799, 2, { colour: 'Black', size: 'M', compareAtPrice: 999, reservedQuantity: 1 }),
      variant('GB-TEE-BLK-L', 'Black · L', 799, 18, { colour: 'Black', size: 'L', compareAtPrice: 999 }),
      variant('GB-TEE-OLV-M', 'Olive · M', 799, 0, { colour: 'Olive', size: 'M' }),
    ],
  }),
  product(6, {
    name: 'Seamless Training Shorts', sku: 'GB-SHO', brand: 'GymBro', basePrice: 1099, categoryId: 2, images: images('shorts'),
    variants: [
      variant('GB-SHO-M', 'Charcoal · M', 1099, 20, { colour: 'Charcoal', size: 'M' }),
      variant('GB-SHO-L', 'Charcoal · L', 1099, 14, { colour: 'Charcoal', size: 'L' }),
    ],
  }),
  product(7, {
    name: 'Leakproof Shaker 700 ml', sku: 'GB-SHK', brand: 'GymBro', basePrice: 449, categoryId: 3, isFeatured: true, images: images('shaker'),
    variants: [
      variant('GB-SHK-BLK', 'Black', 449, 80, { colour: 'Black', reservedQuantity: 4 }),
      variant('GB-SHK-LIM', 'Lime', 449, 5, { colour: 'Lime' }),
    ],
  }),
  product(8, {
    name: 'Lever Lifting Belt', sku: 'GB-BELT', brand: 'IronGrip', basePrice: 4999, categoryId: 3,
    specifications: { Material: '10 mm leather', Warranty: '1 year' }, images: images('belt'),
    variants: [variant('GB-BELT-M', 'Medium', 4999, 6, { size: 'M' }), variant('GB-BELT-L', 'Large', 4999, 1, { size: 'L' })],
  }),
  product(9, {
    name: 'Adjustable Dumbbells 24 kg', sku: 'GB-DB24', brand: 'IronGrip', basePrice: 18999, compareAtPrice: 21999, categoryId: 4, isFeatured: true,
    specifications: { Weight: '2.5–24 kg each', Warranty: '2 years' }, images: images('dumbbell'),
    variants: [variant('GB-DB24-PR', 'Pair', 18999, 4, { weight: '24 kg', compareAtPrice: 21999, reservedQuantity: 1, lowStockThreshold: 3 })],
  }),
  product(10, {
    name: 'Resistance Band Set', sku: 'GB-BAND', brand: 'GymBro', basePrice: 1499, categoryId: 4, isNew: true, images: images('bands'),
    variants: [variant('GB-BAND-5', 'Set of 5', 1499, 25, {})],
  }),
];

const withStock = (v: V): ShopAdminVariant => {
  const stock = Math.max(0, v.quantityOnHand - v.reservedQuantity);
  return { ...v, stock, inStock: v.isActive && stock > 0 };
};
const fullProduct = (p: Prod): ShopAdminProduct => ({
  ...p, images: [...p.images].sort((a, b) => a.sortOrder - b.sortOrder), variants: p.variants.map(withStock),
});
const defaultVariant = (p: Prod) => p.variants.find(v => v.isDefault) ?? p.variants[0];
const primaryImage = (p: Prod) => (p.images.find(i => i.isPrimary) ?? [...p.images].sort((a, b) => a.sortOrder - b.sortOrder)[0])?.url ?? null;

const productRow = (p: Prod): ShopAdminProductRow => {
  const d = defaultVariant(p);
  return {
    id: p.id, name: p.name, slug: p.slug, sku: p.sku, categoryName: categories.find(c => c.id === p.categoryId)?.name ?? null,
    price: d?.price ?? p.basePrice, compareAtPrice: d?.compareAtPrice ?? p.compareAtPrice,
    totalStock: p.variants.reduce((a, v) => a + withStock(v).stock, 0), variantCount: p.variants.length,
    isActive: p.isActive, isFeatured: p.isFeatured, isNew: p.isNew, primaryImageUrl: primaryImage(p), updatedAt: p.updatedAt,
  };
};

const inventoryRow = (p: Prod, v: V): ShopInventoryRow => {
  const available = Math.max(0, v.quantityOnHand - v.reservedQuantity);
  return {
    variantId: v.id, productId: p.id, productName: p.name, variantName: v.name, sku: v.sku, imageUrl: primaryImage(p),
    quantityOnHand: v.quantityOnHand, reservedQuantity: v.reservedQuantity, available, lowStockThreshold: v.lowStockThreshold,
    isLowStock: available <= v.lowStockThreshold,
  };
};
const allInventory = () => products.flatMap(p => p.variants.map(v => inventoryRow(p, v)));
const findVariant = (variantId: number) => {
  for (const p of products) { const v = p.variants.find(x => x.id === variantId); if (v) return { p, v }; }
  return null;
};

const categoryDto = (c: Cat): ShopCategory => {
  const kids = categories.filter(x => x.parentId === c.id).map(x => x.id);
  return {
    ...c, children: [],
    productCount: products.filter(p => p.categoryId === c.id || kids.includes(p.categoryId)).length,
  };
};

// ── Customers ───────────────────────────────────────────────────────────

const address = (id: number, fullName: string, line1: string, city: string, state: string, postalCode: string, phone: string, isDefault = true): ShopAddress =>
  ({ id, label: isDefault ? 'Home' : 'Work', fullName, phone, line1, line2: null, city, state, postalCode, country: 'India', isDefault });

interface Cust { row: Omit<ShopCustomerRow, 'ordersCount' | 'totalSpent' | 'lastOrderAt'>; addresses: ShopAddress[] }
const customers: Cust[] = [
  ['Aarav', 'Mehta', 'aarav@example.com', '+91 98765 43210', 'Mumbai', 'Maharashtra', '400050', 120],
  ['Sara', 'Khan', 'sara@example.com', '+91 98765 43211', 'Pune', 'Maharashtra', '411001', 90],
  ['Rohan', 'Das', 'rohan@example.com', '+91 98765 43212', 'Bengaluru', 'Karnataka', '560001', 75],
  ['Meera', 'Nair', 'meera@example.com', null, 'Kochi', 'Kerala', '682001', 40],
  ['Kabir', 'Shah', 'kabir@example.com', '+91 98765 43214', 'Ahmedabad', 'Gujarat', '380001', 12],
  ['Ananya', 'Iyer', 'ananya@example.com', '+91 98765 43215', 'Chennai', 'Tamil Nadu', '600001', 3],
].map(([firstName, lastName, email, phone, city, state, pin, joined], i) => ({
  row: {
    id: 100 + i, email: email as string, firstName: firstName as string, lastName: lastName as string, phone: phone as string | null,
    isActive: i !== 4, status: i === 4 ? 'Inactive' : 'Active', roles: ['Member'], createdAt: daysAgo(joined as number),
  },
  addresses: [address(500 + i, `${firstName} ${lastName}`, `${10 + i * 7}, Fitness Lane`, city as string, state as string, pin as string, (phone as string) ?? '+91 90000 00000')],
}));

// ── Orders ──────────────────────────────────────────────────────────────

const FLOW: ShopOrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'OutForDelivery', 'Delivered'];
const AT_KEY: Record<ShopOrderStatus, keyof ShopOrder> = {
  Pending: 'placedAt', Confirmed: 'confirmedAt', Processing: 'processingAt', Shipped: 'shippedAt',
  OutForDelivery: 'outForDeliveryAt', Delivered: 'deliveredAt', Cancelled: 'cancelledAt',
};

let orderSeq = 1040;
function makeOrder(custIdx: number, lines: [number, number, number][], status: ShopOrderStatus, ageDays: number, opts: Partial<ShopOrder> = {}): ShopOrder {
  const c = customers[custIdx];
  const items = lines.map(([pid, vIdx, qty], k) => {
    const p = products.find(x => x.id === pid)!;
    const v = p.variants[vIdx];
    return {
      id: newId(), productId: p.id, variantId: v.id, productName: p.name, productSlug: p.slug, variantName: v.name, sku: v.sku,
      imageUrl: primaryImage(p), unitPrice: v.price, quantity: qty, lineTotal: v.price * qty, _k: k,
    };
  }).map(({ _k: _unused, ...i }) => i);
  const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
  const discount = opts.couponCode === 'WELCOME10' ? Math.min(1000, Math.round(subtotal * 0.1)) : opts.couponCode === 'FIT500' ? 500 : 0;
  const shipping = subtotal - discount >= settings.freeShippingThreshold ? 0 : settings.standardShipping;
  const tax = Math.round(((subtotal - discount) * settings.taxRate) / (1 + settings.taxRate) * 100) / 100;
  const total = subtotal - discount + shipping;
  const a = c.addresses[0];
  const reached = status === 'Cancelled' ? 1 : FLOW.indexOf(status);
  const o: ShopOrder = {
    id: newId(), orderNumber: `${settings.orderPrefix}-${++orderSeq}`, status, subtotal, discount, shipping, tax, total,
    couponCode: null, deliveryMethod: 'Standard', notes: null, trackingNumber: null,
    placedAt: daysAgo(ageDays, 3), confirmedAt: null, processingAt: null, shippedAt: null, outForDeliveryAt: null, deliveredAt: null, cancelledAt: null,
    estimatedDelivery: daysAgo(ageDays - settings.standardDeliveryDays),
    shippingAddress: { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country },
    payment: { method: custIdx % 3 === 0 ? 'Upi' : custIdx % 3 === 1 ? 'CashOnDelivery' : 'Card', status: 'Pending', amount: total, transactionReference: null, paidAt: null },
    items, timeline: [],
    customerId: c.row.id, customerName: `${c.row.firstName} ${c.row.lastName}`, customerEmail: c.row.email, customerPhone: c.row.phone,
    ...opts,
  };
  for (let i = 1; i <= reached; i++) (o as unknown as Record<string, string>)[AT_KEY[FLOW[i]]] = daysAgo(Math.max(0, ageDays - i), 1);
  if (status === 'Cancelled') o.cancelledAt = daysAgo(Math.max(0, ageDays - 1));
  if (o.payment && o.payment.method !== 'CashOnDelivery') { o.payment.status = status === 'Cancelled' ? 'Refunded' : 'Paid'; o.payment.paidAt = o.placedAt; o.payment.transactionReference = `pay_${o.id}XK`; }
  if (o.payment && status === 'Delivered') { o.payment.status = 'Paid'; o.payment.paidAt = o.deliveredAt; }
  if (reached >= 3 && status !== 'Cancelled') o.trackingNumber = `DTDC${7_120_000 + o.id}`;
  return o;
}

let orders: ShopOrder[] = [
  makeOrder(0, [[1, 0, 1], [7, 0, 2]], 'Pending', 0, { notes: 'Please call before delivery.' }),
  makeOrder(1, [[5, 1, 1], [6, 0, 1]], 'Confirmed', 1),
  makeOrder(2, [[9, 0, 1]], 'Processing', 2, { couponCode: 'FIT500' }),
  makeOrder(3, [[3, 1, 1], [2, 0, 2]], 'Shipped', 4),
  makeOrder(0, [[1, 2, 1]], 'OutForDelivery', 5, { deliveryMethod: 'Express' }),
  makeOrder(5, [[1, 0, 1], [10, 0, 1]], 'Delivered', 9, { couponCode: 'WELCOME10' }),
  makeOrder(1, [[8, 0, 1]], 'Delivered', 16),
  makeOrder(4, [[7, 1, 1]], 'Cancelled', 20),
];

function timelineOf(o: ShopOrder): ShopOrder['timeline'] {
  if (o.status === 'Cancelled') {
    const done = FLOW.filter(s => !!o[AT_KEY[s]]);
    return [...done.map(s => ({ status: s, at: o[AT_KEY[s]] as string, completed: true })), { status: 'Cancelled', at: o.cancelledAt, completed: true }];
  }
  return FLOW.map(s => ({ status: s, at: (o[AT_KEY[s]] as string | null) ?? null, completed: !!o[AT_KEY[s]] }));
}
const orderDto = (o: ShopOrder): ShopOrder => ({ ...o, timeline: timelineOf(o) });
const orderSummary = (o: ShopOrder): ShopOrderSummary => ({
  id: o.id, orderNumber: o.orderNumber, status: o.status, total: o.total, itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
  placedAt: o.placedAt, previewImages: o.items.map(i => i.imageUrl).filter((u): u is string => !!u).slice(0, 3),
  customerName: o.customerName, customerEmail: o.customerEmail,
});

const customerRow = (c: Cust): ShopCustomerRow => {
  const mine = orders.filter(o => o.customerId === c.row.id);
  const counted = mine.filter(o => o.status !== 'Cancelled');
  return {
    ...c.row, ordersCount: mine.length, totalSpent: counted.reduce((a, o) => a + o.total, 0),
    lastOrderAt: mine.map(o => o.placedAt).sort().pop() ?? null,
  };
};

// ── Coupons ─────────────────────────────────────────────────────────────

let coupons: ShopCoupon[] = [
  { id: 1, code: 'WELCOME10', description: '10% off your first order', discountType: 0, value: 10, minOrderAmount: 1500, maxDiscountAmount: 1000,
    startsAt: null, endsAt: daysAgo(-60), usageLimit: 500, usedCount: 37, isActive: true, createdAt: daysAgo(90) },
  { id: 2, code: 'FIT500', description: '₹500 off big orders', discountType: 1, value: 500, minOrderAmount: 5000, maxDiscountAmount: null,
    startsAt: null, endsAt: null, usageLimit: null, usedCount: 12, isActive: true, createdAt: daysAgo(45) },
];

// ── Dashboard ───────────────────────────────────────────────────────────

// Deterministic 30-day sales curve (no Math.random so the preview looks the same on every load).
const SALES = Array.from({ length: 30 }, (_, i) => {
  const ordersN = 3 + ((i * 7) % 5) + Math.floor(i / 6);
  return { date: daysAgo(29 - i).slice(0, 10), orders: ordersN, revenue: ordersN * (1900 + ((i * 431) % 1700)) };
});

function dashboard(): ShopDashboard {
  const revenueLast30Days = SALES.reduce((a, s) => a + s.revenue, 0);
  const ordersCount = 412 + orders.length;
  const statusCounts = (['Pending', 'Confirmed', 'Processing', 'Shipped', 'OutForDelivery', 'Delivered', 'Cancelled'] as ShopOrderStatus[])
    .map(status => ({ status, count: orders.filter(o => o.status === status).length + (status === 'Delivered' ? 380 : status === 'Cancelled' ? 24 : 0) }));
  const tops = products.slice(0, 7).map((p, i) => ({
    productId: p.id, name: p.name, imageUrl: primaryImage(p), unitsSold: 140 - i * 17, revenue: (140 - i * 17) * (defaultVariant(p)?.price ?? p.basePrice),
  })).sort((a, b) => b.revenue - a.revenue);
  return {
    totalRevenue: 1_284_500 + revenueLast30Days, ordersCount, customersCount: customers.length + 212, productsCount: products.length,
    averageOrderValue: Math.round(revenueLast30Days / SALES.reduce((a, s) => a + s.orders, 0)),
    revenueLast30Days, revenuePrevious30Days: Math.round(revenueLast30Days * 0.87),
    salesByDay: SALES, ordersByStatus: statusCounts, topProducts: tops.slice(0, 5),
    recentOrders: [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, 6).map(orderSummary),
    lowStock: allInventory().filter(i => i.isLowStock).sort((a, b) => a.available - b.available),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function paginate<T>(items: T[], query: URLSearchParams) {
  const pageSize = Math.max(1, Number(query.get('pageSize')) || 20);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageNumber = Math.min(Math.max(1, Number(query.get('page')) || 1), totalPages);
  return ok({ items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), pageNumber, pageSize, totalRecords: items.length, totalPages });
}
const matches = (q: string | null, ...fields: (string | null | undefined)[]) =>
  !q || fields.some(f => f?.toLowerCase().includes(q.toLowerCase()));

const skuTaken = (sku: string, exceptVariant?: number, exceptProduct?: number) =>
  products.some(p => (p.id !== exceptProduct && p.sku === sku) || p.variants.some(v => v.id !== exceptVariant && v.sku === sku && p.id !== exceptProduct));

function applyVariant(v: V, b: ShopVariantInput) {
  Object.assign(v, {
    sku: b.sku, name: b.name, flavour: b.flavour ?? null, size: b.size ?? null, colour: b.colour ?? null, weight: b.weight ?? null,
    price: b.price, compareAtPrice: b.compareAtPrice ?? null, isActive: b.isActive,
    lowStockThreshold: b.lowStockThreshold ?? v.lowStockThreshold,
  });
}
function setDefault(p: Prod, v: V, isDefault: boolean) {
  if (isDefault) p.variants.forEach(x => { x.isDefault = x === v; });
  else if (v.isDefault && p.variants.length > 1) { v.isDefault = false; p.variants.find(x => x !== v)!.isDefault = true; }
  else if (!p.variants.some(x => x.isDefault)) v.isDefault = true;
}
const touch = (p: Prod) => { p.updatedAt = new Date().toISOString(); };

function fileUrl(body: unknown): { url: string; altText: string | null; isPrimary: boolean } {
  const form = body as FormData | undefined;
  const file = typeof FormData !== 'undefined' && form instanceof FormData ? form.get('file') : null;
  const url = file && typeof file !== 'string' && typeof URL !== 'undefined' ? URL.createObjectURL(file) : img(`upload-${newId()}`);
  return {
    url,
    altText: (form instanceof FormData ? (form.get('altText') as string | null) : null) ?? null,
    isPrimary: form instanceof FormData ? form.get('isPrimary') === 'true' : false,
  };
}

// ── Router ──────────────────────────────────────────────────────────────

export function shopAdminRoute(method: string, path: string, body: unknown, query: URLSearchParams): unknown | undefined {
  const p = path.replace(/^\/shop\/admin/, '');
  const seg = p.split('/').filter(Boolean);
  const b = (body ?? {}) as Record<string, unknown>;

  if (p === '/dashboard' && method === 'get') return ok(dashboard());

  // Settings
  if (p === '/settings') {
    if (method === 'put') settings = { ...settings, ...(b as Partial<ShopSettings>) };
    return ok(settings);
  }

  // Products
  if (seg[0] === 'products') {
    const id = seg[1] ? Number(seg[1]) : null;
    const prod = id ? products.find(x => x.id === id) : undefined;

    if (!id) {
      if (method === 'get') {
        const q = query.get('search');
        const status = query.get('status') ?? 'all';
        const cat = query.get('categoryId') ? Number(query.get('categoryId')) : null;
        const catIds = cat ? [cat, ...categories.filter(c => c.parentId === cat).map(c => c.id)] : null;
        const list = products
          .filter(x => matches(q, x.name, x.sku, x.brand, ...x.variants.map(v => v.sku)))
          .filter(x => status === 'all' || (status === 'active' ? x.isActive : !x.isActive))
          .filter(x => !catIds || catIds.includes(x.categoryId))
          .sort((a, c) => c.updatedAt.localeCompare(a.updatedAt))
          .map(productRow);
        return paginate(list, query);
      }
      if (method === 'post') {
        const inp = b as unknown as ShopProductInput;
        const sku = inp.sku.trim().toUpperCase();
        if (skuTaken(sku)) return fail(`A product with SKU ${sku} already exists`, [`SKU: ${sku} is already used.`]);
        const np: Prod = {
          id: newId(), name: inp.name, slug: inp.slug || slugify(inp.name), sku, shortDescription: inp.shortDescription ?? null,
          description: inp.description ?? null, brand: inp.brand ?? null, basePrice: inp.basePrice, compareAtPrice: inp.compareAtPrice ?? null,
          categoryId: inp.categoryId, isActive: inp.isActive, isFeatured: inp.isFeatured, isNew: inp.isNew, specifications: inp.specifications,
          images: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          // Like the server: every product starts with a default "Standard" variant.
          variants: [variant(sku, 'Standard', inp.basePrice, 0, { compareAtPrice: inp.compareAtPrice ?? null, isDefault: true })],
        };
        products = [np, ...products];
        return ok(fullProduct(np));
      }
      return undefined;
    }
    if (!prod) return fail('Product not found');

    if (seg.length === 2) {
      if (method === 'get') return ok(fullProduct(prod));
      if (method === 'put') {
        const inp = b as unknown as ShopProductInput;
        Object.assign(prod, {
          name: inp.name, slug: inp.slug || slugify(inp.name), sku: inp.sku, shortDescription: inp.shortDescription ?? null,
          description: inp.description ?? null, brand: inp.brand ?? null, basePrice: inp.basePrice, compareAtPrice: inp.compareAtPrice ?? null,
          categoryId: inp.categoryId, isActive: inp.isActive, isFeatured: inp.isFeatured, isNew: inp.isNew, specifications: inp.specifications,
        });
        touch(prod);
        return ok(fullProduct(prod));
      }
      if (method === 'delete') { products = products.filter(x => x !== prod); return ok(null); }
    }

    if (seg[2] === 'variants') {
      const vid = seg[3] ? Number(seg[3]) : null;
      const inp = b as unknown as ShopVariantInput;
      if (!vid && method === 'post') {
        const sku = inp.sku.trim().toUpperCase();
        if (skuTaken(sku)) return fail(`A variant with SKU ${sku} already exists`, [`SKU: ${sku} is already used.`]);
        const nv = variant(sku, inp.name, inp.price, inp.initialStock ?? 0);
        applyVariant(nv, { ...inp, sku });
        prod.variants.push(nv);
        setDefault(prod, nv, inp.isDefault);
        touch(prod);
        return ok(fullProduct(prod));
      }
      const v = prod.variants.find(x => x.id === vid);
      if (!v) return fail('Variant not found');
      if (method === 'put') {
        if (skuTaken(inp.sku, v.id)) return fail(`A variant with SKU ${inp.sku} already exists`);
        applyVariant(v, inp);
        setDefault(prod, v, inp.isDefault);
        touch(prod);
        return ok(fullProduct(prod));
      }
      if (method === 'delete') {
        if (prod.variants.length <= 1) return fail('A product needs at least one variant.');
        prod.variants = prod.variants.filter(x => x !== v);
        if (v.isDefault) prod.variants[0].isDefault = true;
        touch(prod);
        return ok(fullProduct(prod));
      }
    }

    if (seg[2] === 'images') {
      const imageId = seg[3] && seg[3] !== 'url' ? Number(seg[3]) : null;
      if (!imageId && method === 'post') {
        {
          // The picked file becomes a blob: URL so the preview shows the real photo.
          const f = seg[3] === 'url'
            ? { url: String(b.url), altText: (b.altText as string | null) ?? null, isPrimary: !!b.isPrimary }
            : fileUrl(body);
          const isPrimary = f.isPrimary || prod.images.length === 0;
          if (isPrimary) prod.images.forEach(i => { i.isPrimary = false; });
          prod.images.push({ id: newId(), url: f.url, altText: f.altText, sortOrder: Math.max(-1, ...prod.images.map(i => i.sortOrder)) + 1, isPrimary });
          touch(prod);
          return ok(fullProduct(prod));
        }
      }
      const im = prod.images.find(i => i.id === imageId);
      if (!im) return fail('Image not found');
      if (method === 'patch') {
        const next = { altText: (b.altText as string | null) ?? im.altText, sortOrder: Number(b.sortOrder ?? im.sortOrder), isPrimary: !!b.isPrimary };
        // Moving onto another image's slot swaps the two.
        const other = prod.images.find(i => i !== im && i.sortOrder === next.sortOrder);
        if (other) other.sortOrder = im.sortOrder;
        if (next.isPrimary) prod.images.forEach(i => { i.isPrimary = i === im; });
        Object.assign(im, next);
        if (!prod.images.some(i => i.isPrimary)) im.isPrimary = true;
        touch(prod);
        return ok(fullProduct(prod));
      }
      if (method === 'delete') {
        prod.images = prod.images.filter(i => i !== im);
        if (im.isPrimary && prod.images[0]) prod.images[0].isPrimary = true;
        touch(prod);
        return ok(fullProduct(prod));
      }
    }
    return undefined;
  }

  // Categories
  if (seg[0] === 'categories') {
    const id = seg[1] ? Number(seg[1]) : null;
    if (!id && method === 'get') return ok(categories.map(categoryDto));
    const inp = b as unknown as ShopCategoryInput;
    if (!id && method === 'post') {
      const slug = inp.slug || slugify(inp.name);
      if (categories.some(c => c.slug === slug)) return fail(`A category with slug ${slug} already exists`, [`Slug: ${slug} is already used.`]);
      const c: Cat = { id: newId(), name: inp.name, slug, description: inp.description ?? null, imageUrl: inp.imageUrl ?? null, parentId: inp.parentId ?? null, sortOrder: inp.sortOrder, isActive: inp.isActive };
      categories = [...categories, c];
      return ok(categoryDto(c));
    }
    const cat = categories.find(c => c.id === id);
    if (!cat) return fail('Category not found');
    if (method === 'put') {
      if (inp.parentId === cat.id) return fail('A category cannot be its own parent.');
      Object.assign(cat, { name: inp.name, slug: inp.slug || slugify(inp.name), description: inp.description ?? null, imageUrl: inp.imageUrl ?? null, parentId: inp.parentId ?? null, sortOrder: inp.sortOrder, isActive: inp.isActive });
      return ok(categoryDto(cat));
    }
    if (method === 'delete') {
      const dto = categoryDto(cat);
      if (categories.some(c => c.parentId === cat.id)) return fail(`${cat.name} has sub-categories. Move or delete them first.`);
      if (dto.productCount > 0) return fail(`${cat.name} still has ${dto.productCount} product${dto.productCount === 1 ? '' : 's'}. Move or delete them first.`);
      categories = categories.filter(c => c !== cat);
      return ok(null);
    }
    return undefined;
  }

  // Inventory
  if (seg[0] === 'inventory') {
    if (!seg[1] && method === 'get') {
      const q = query.get('search');
      const lowOnly = query.get('lowStockOnly') === 'true';
      const rows = allInventory()
        .filter(i => matches(q, i.productName, i.variantName, i.sku))
        .filter(i => !lowOnly || i.isLowStock)
        .sort((a, c) => (lowOnly ? a.available - c.available : a.productName.localeCompare(c.productName)));
      return paginate(rows, query);
    }
    if (seg[1] && method === 'patch') {
      const found = findVariant(Number(seg[1]));
      if (!found) return fail('Variant not found');
      const u = b as ShopInventoryUpdate;
      const next = u.quantityOnHand !== undefined ? u.quantityOnHand : found.v.quantityOnHand + (u.adjustment ?? 0);
      if (next < found.v.reservedQuantity) return fail(`On hand can't go below the ${found.v.reservedQuantity} units reserved for open orders.`);
      found.v.quantityOnHand = next;
      if (u.lowStockThreshold !== undefined) found.v.lowStockThreshold = u.lowStockThreshold;
      touch(found.p);
      return ok(inventoryRow(found.p, found.v));
    }
    return undefined;
  }

  // Orders
  if (seg[0] === 'orders') {
    if (!seg[1] && method === 'get') {
      const q = query.get('search');
      const status = query.get('status');
      const list = orders
        .filter(o => !status || o.status === status)
        .filter(o => matches(q, o.orderNumber, o.customerName, o.customerEmail))
        .sort((a, c) => c.placedAt.localeCompare(a.placedAt))
        .map(orderSummary);
      return paginate(list, query);
    }
    const o = orders.find(x => x.orderNumber === decodeURIComponent(seg[1] ?? ''));
    if (!o) return fail('Order not found');
    if (seg.length === 2 && method === 'get') return ok(orderDto(o));
    if (seg[2] === 'status' && method === 'patch') {
      const to = b.status as ShopOrderStatus;
      const now = new Date().toISOString();
      if (to === 'Cancelled') {
        if (!['Pending', 'Confirmed', 'Processing'].includes(o.status)) return fail('Only orders that have not shipped can be cancelled.');
        // Restock: release what the order reserved.
        o.items.forEach(i => { const f = findVariant(i.variantId); if (f) f.v.reservedQuantity = Math.max(0, f.v.reservedQuantity - i.quantity); });
        o.status = 'Cancelled';
        o.cancelledAt = now;
        if (o.payment?.status === 'Paid') o.payment.status = 'Refunded';
        return ok(orderDto(o));
      }
      const idx = FLOW.indexOf(o.status);
      if (FLOW[idx + 1] !== to) return fail(`An order that is ${o.status} can't move to ${to}.`);
      (o as unknown as Record<string, string>)[AT_KEY[to]] = now;
      o.status = to;
      if (to === 'Shipped') {
        o.trackingNumber = (b.trackingNumber as string | null) || o.trackingNumber;
        // Shipping takes the reserved units out of the building.
        o.items.forEach(i => {
          const f = findVariant(i.variantId);
          if (f) { f.v.quantityOnHand = Math.max(0, f.v.quantityOnHand - i.quantity); f.v.reservedQuantity = Math.max(0, f.v.reservedQuantity - i.quantity); }
        });
      }
      if (to === 'Delivered' && o.payment) { o.payment.status = 'Paid'; o.payment.paidAt = now; }
      return ok(orderDto(o));
    }
    return undefined;
  }

  // Customers
  if (seg[0] === 'customers') {
    if (!seg[1] && method === 'get') {
      const q = query.get('search');
      return paginate(customers.filter(c => matches(q, c.row.firstName, c.row.lastName, `${c.row.firstName} ${c.row.lastName}`, c.row.email, c.row.phone))
        .map(customerRow).sort((a, c) => c.createdAt.localeCompare(a.createdAt)), query);
    }
    const c = customers.find(x => x.row.id === Number(seg[1]));
    if (!c) return fail('Customer not found');
    return ok({
      ...customerRow(c), addresses: c.addresses,
      recentOrders: orders.filter(o => o.customerId === c.row.id).sort((a, x) => x.placedAt.localeCompare(a.placedAt)).slice(0, 10).map(orderSummary),
    });
  }

  // Coupons
  if (seg[0] === 'coupons') {
    const id = seg[1] ? Number(seg[1]) : null;
    if (!id && method === 'get') return ok([...coupons].sort((a, c) => c.createdAt.localeCompare(a.createdAt)));
    const inp = b as unknown as ShopCouponInput;
    if (!id && method === 'post') {
      if (coupons.some(c => c.code === inp.code)) return fail(`Coupon ${inp.code} already exists`, [`Code: ${inp.code} is already used.`]);
      const c: ShopCoupon = { ...inp, id: newId(), usedCount: 0, createdAt: new Date().toISOString() };
      coupons = [c, ...coupons];
      return ok(c);
    }
    const c = coupons.find(x => x.id === id);
    if (!c) return fail('Coupon not found');
    if (method === 'put') {
      if (coupons.some(x => x !== c && x.code === inp.code)) return fail(`Coupon ${inp.code} already exists`);
      Object.assign(c, inp);
      return ok(c);
    }
    if (method === 'delete') { coupons = coupons.filter(x => x !== c); return ok(null); }
    return undefined;
  }

  return undefined;
}
