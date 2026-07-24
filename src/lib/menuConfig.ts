/**
 * Single source of truth for the entire menu.
 *
 * Everything the app needs — the category lists, the valid-sides map, the
 * standalone/optional sets, and every price — is DERIVED from the `MENU`
 * array below. Add or change a dish in one place and the ordering page, the
 * orders/summary page, and pricing all stay in sync automatically.
 *
 * Design notes:
 * - A "side" price is the TOTAL price of the (main + side) combination, not a
 *   delta. That mirrors how the app persists an order as the string
 *   `"Main + Side"` and how the seller reads a flat price per line.
 * - Pricing is an EXACT-MATCH lookup built from this structure — there is no
 *   `string.includes(...)` guessing, so an item named "Juice ..." or one that
 *   happens to contain a "+" can never trip the wrong branch.
 */

export type MenuCategory = "food" | "fruits" | "juice";

export interface MenuSide {
  /** Display + persisted name of the side/stew/add-on. */
  name: string;
  /** TOTAL price of the `main + this side` combination, in TZS. */
  price: number;
}

export interface MenuItemDef {
  /** Display + persisted name of the main item. */
  name: string;
  category: MenuCategory;
  /**
   * Price when ordered on its own, in TZS. Presence of this field is what
   * makes an item standalone-submittable (Pilau, Fruits, Juice Dates, and the
   * mixed juice which is standalone AND accepts optional add-ons).
   */
  standalonePrice?: number;
  /** Allowed sides/stews/add-ons and each combination's total price. */
  sides?: MenuSide[];
  /**
   * When true the item can be submitted alone OR with one of its `sides`
   * (the sides are optional add-ons rather than a required stew).
   */
  sidesOptional?: boolean;
}

/**
 * THE MENU. Edit prices and combinations here only.
 */
export const MENU: readonly MenuItemDef[] = [
  {
    name: "Ugali",
    category: "food",
    sides: [
      { name: "Utumbo wa Mbogamboga", price: 5000 },
      { name: "Kuku Lobo", price: 5000 },
      { name: "Nyama Choma (Ng'ombe)", price: 5000 },
    ],
  },
  {
    name: "Wali",
    category: "food",
    sides: [
      { name: "Nyama", price: 4000 },
      { name: "Njegere", price: 4000 },
      { name: "Maini", price: 4000 },
      { name: "Kokoto", price: 4000 },
      { name: "Dagaa", price: 4000 },
      { name: "Utumbo", price: 4000 },
      { name: "Samaki", price: 5000 },
    ],
  },
  {
    name: "Pilau",
    category: "food",
    standalonePrice: 5000,
  },
  {
    name: "Chips",
    category: "food",
    sides: [
      { name: "Kuku", price: 5000 },
      { name: "Paja", price: 5000 },
      { name: "Mishkaki (Vipande 3)", price: 5000 },
      { name: "Mayai", price: 3000 },
      { name: "Kidari", price: 5000 },
    ],
  },
  {
    name: "Ndizi",
    category: "food",
    sides: [{ name: "Nyama", price: 5000 }],
  },
  {
    name: "Fruits",
    category: "fruits",
    standalonePrice: 3000,
  },
  {
    name: "Juice (Mix/Mango/Passion)",
    category: "juice",
    standalonePrice: 3000,
    sidesOptional: true,
    sides: [
      { name: "Cashewnuts", price: 5000 },
      { name: "Groundnuts", price: 4000 },
    ],
  },
  {
    name: "Juice (Dates)",
    category: "juice",
    standalonePrice: 5000,
  },
] as const;

/** Separator used to persist/display a combination: `"<main> + <side>"`. */
export const COMBO_SEPARATOR = " + ";

const itemsByCategory = (category: MenuCategory): string[] =>
  MENU.filter((item) => item.category === category).map((item) => item.name);

// ---------------------------------------------------------------------------
// Derived lists (keep the exact names the pages already import)
// ---------------------------------------------------------------------------

export const foodDishes = itemsByCategory("food");
export const fruitsDishes = itemsByCategory("fruits");
export const juiceDishes = itemsByCategory("juice");
export const mainDishes = MENU.map((item) => item.name);

/** main name -> allowed side names. Only items that have sides appear. */
export const validSidesMap: Record<string, string[]> = Object.fromEntries(
  MENU.filter((item) => item.sides && item.sides.length > 0).map((item) => [
    item.name,
    item.sides!.map((side) => side.name),
  ])
);

/** Items submittable without a side (i.e. they have a standalone price). */
export const standaloneItems = new Set(
  MENU.filter((item) => item.standalonePrice !== undefined).map(
    (item) => item.name
  )
);

/** Standalone items that ALSO allow optional add-on sides. */
export const optionalSideItems = new Set(
  MENU.filter((item) => item.sidesOptional).map((item) => item.name)
);

// ---------------------------------------------------------------------------
// Pricing — exact-match lookup derived from MENU (no string heuristics)
// ---------------------------------------------------------------------------

const categoryByName = new Map<string, MenuCategory>(
  MENU.map((item) => [item.name, item.category])
);

/** Every priceable string the app can produce -> its price. */
export const priceMap: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const item of MENU) {
    if (item.standalonePrice !== undefined) {
      map[item.name] = item.standalonePrice;
    }
    for (const side of item.sides ?? []) {
      map[`${item.name}${COMBO_SEPARATOR}${side.name}`] = side.price;
    }
  }
  return map;
})();

/**
 * Price of an order line. Accepts a standalone name (`"Pilau"`) or a
 * combination (`"Chips + Mayai"`). Unknown strings (e.g. items from an older
 * menu still stored in the DB) return 0 rather than a guessed price.
 */
export const getPriceForItem = (item: string): number => priceMap[item] ?? 0;

/** Category of an order line, resolved from its main dish. */
export const getCategoryForItem = (item: string): MenuCategory | undefined =>
  categoryByName.get(item.split(COMBO_SEPARATOR)[0]);

/** True for fruits/juice lines — used to split food vs extras on the Orders page. */
export const isExtrasItem = (item: string): boolean => {
  const category = getCategoryForItem(item);
  return category === "fruits" || category === "juice";
};

// ---------------------------------------------------------------------------
// Order of the Day — rotates through FOOD combos only
// ---------------------------------------------------------------------------

export const foodCombos: string[] = MENU.filter(
  (item) => item.category === "food" && item.sides && item.sides.length > 0
).flatMap((item) =>
  item.sides!.map((side) => `${item.name}${COMBO_SEPARATOR}${side.name}`)
);

export const getOrderOfTheDay = (): string => {
  if (foodCombos.length === 0) return foodDishes[0] ?? "";
  const dayOfMonth = new Date().getDate();
  return foodCombos[dayOfMonth % foodCombos.length];
};

// ---------------------------------------------------------------------------
// Delivery + payment configuration
// ---------------------------------------------------------------------------

export const DELIVERY_FEE = 0;

export const paymentConfig = {
  food: {
    name: "Bestina Meto",
    phone: "",
    paymentNumber: "1328660",
    paymentType: "Withdrawal to MPESA",
  },
  extras: {
    name: "JUICE ASILI",
    phone: "",
    paymentNumber: "6103 1001",
    paymentType: "Selcom Lipa (*150*50*1#)",
  },
};
