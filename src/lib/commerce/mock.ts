import type { BrandSlug } from "../brands";
import type { Category, CommerceClient, Product } from "./types";

type Seed = [id: string, name: string, price: number, description: string, badge?: string];

const CATEGORIES: Record<BrandSlug, Category[]> = {
  ridgeline: [
    { slug: "tents", name: "Tents", description: "Shelters from solo backpacking to family cabin sizes." },
    { slug: "sleep", name: "Sleep Systems", description: "Bags, pads and pillows for a real night's sleep outside." },
  ],
  tidewater: [
    { slug: "boat-care", name: "Boat Care", description: "Cleaners, wax and protectants for hull and deck." },
    { slug: "safety", name: "Safety", description: "Life vests, flares and onboard emergency gear." },
  ],
  driftwood: [
    { slug: "tees", name: "Tees", description: "Soft everyday tees in relaxed fits." },
    { slug: "headwear", name: "Headwear", description: "Caps and beanies for sun and spray." },
  ],
};

const SEEDS: Record<BrandSlug, Record<string, Seed[]>> = {
  ridgeline: {
    tents: [
      ["RL-1001", "Basecamp 4-Person Tent", 289, "Freestanding three-season tent with two doors and a full-coverage rainfly.", "Best seller"],
      ["RL-1002", "Alpine 2-Person Tent", 219, "Light, fast pitch tent built for weekend trips."],
      ["RL-1003", "Family Cabin Tent, 8-Person", 449, "Near-vertical walls and a room divider for group camping."],
      ["RL-1004", "Trail Pop-Up Shelter", 99, "Sets up in under a minute for day trips and festivals.", "New"],
    ],
    sleep: [
      ["RL-2001", "Down Sleeping Bag, 20F", 179, "Water-resistant down fill rated for cold shoulder seasons."],
      ["RL-2002", "Insulated Camp Pad", 89, "Self-inflating pad with a high R-value for cold ground."],
      ["RL-2003", "Packable Camp Pillow", 29, "Compressible pillow that stuffs down to the size of a water bottle."],
      ["RL-2004", "Mummy Bag, 40F", 109, "Compact synthetic bag for summer camping.", "Sale"],
    ],
  },
  tidewater: {
    "boat-care": [
      ["TW-1001", "Hull Wash Concentrate, 32 oz", 24, "Biodegradable cleaner that lifts salt and scum without stripping wax.", "Best seller"],
      ["TW-1002", "Marine Wax Kit", 49, "Carnauba wax and applicator pads for gelcoat."],
      ["TW-1003", "Teak Cleaner and Brightener", 31, "Two-step system to restore weathered teak."],
      ["TW-1004", "Canvas Protectant Spray", 19, "UV and water protection for bimini tops and covers.", "New"],
    ],
    safety: [
      ["TW-2001", "Type III Life Vest", 59, "Coast Guard-approved foam vest for all-day comfort."],
      ["TW-2002", "Coastal Flare Kit", 64, "Flares and a signal mirror in a floating dry case."],
      ["TW-2003", "Waterproof First Aid Kit", 42, "Marine-grade case with supplies for a crew of six.", "Best seller"],
      ["TW-2004", "LED Anchor Light", 38, "All-around white light with a 12 V plug and mounting bracket."],
    ],
  },
  driftwood: {
    tees: [
      ["DW-1001", "Everyday Pocket Tee", 32, "Heavyweight cotton tee with a relaxed fit.", "Best seller"],
      ["DW-1002", "Coastline Graphic Tee", 36, "Screen-printed chart of a favorite stretch of coast."],
      ["DW-1003", "Long Sleeve Sun Shirt", 54, "UPF 50 fabric that dries fast."],
      ["DW-1004", "Garment-Dyed Tee", 34, "Washed color with a vintage hand-feel.", "New"],
    ],
    headwear: [
      ["DW-2001", "Five-Panel Camp Cap", 28, "Unstructured cotton cap with an adjustable strap."],
      ["DW-2002", "Waxed Canvas Bucket Hat", 38, "Water-resistant brim for sun and spray."],
      ["DW-2003", "Ribbed Wool Beanie", 26, "Warm, stretchy and made to travel."],
      ["DW-2004", "Trucker Hat", 30, "Mesh back with a curved brim.", "Sale"],
    ],
  },
};

function build(): Product[] {
  const products: Product[] = [];
  for (const brand of Object.keys(SEEDS) as BrandSlug[]) {
    for (const [category, seeds] of Object.entries(SEEDS[brand])) {
      for (const [id, name, price, description, badge] of seeds) {
        products.push({
          id,
          brand,
          category,
          name,
          price,
          currency: "USD",
          description,
          badge,
          inStock: id.slice(-1) !== "3" || brand !== "tidewater",
        });
      }
    }
  }
  return products;
}

const PRODUCTS = build();

/** Small simulated latency so streaming and caching behavior are visible. */
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 0);
const wait = () => (LATENCY_MS > 0 ? new Promise((r) => setTimeout(r, LATENCY_MS)) : Promise.resolve());

export const mockClient: CommerceClient = {
  async getCategories(brand) {
    await wait();
    return CATEGORIES[brand];
  },
  async getCategory(brand, slug) {
    await wait();
    return CATEGORIES[brand].find((c) => c.slug === slug) ?? null;
  },
  async getFeatured(brand) {
    await wait();
    return PRODUCTS.filter((p) => p.brand === brand && p.badge).slice(0, 4);
  },
  async listProducts(brand) {
    await wait();
    return PRODUCTS.filter((p) => p.brand === brand);
  },
  async getProductsByCategory(brand, category) {
    await wait();
    return PRODUCTS.filter((p) => p.brand === brand && p.category === category);
  },
  async getProduct(brand, id) {
    await wait();
    return PRODUCTS.find((p) => p.brand === brand && p.id === id) ?? null;
  },
  async searchProducts(brand, query) {
    await wait();
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PRODUCTS.filter(
      (p) =>
        p.brand === brand &&
        (p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)),
    );
  },
};
