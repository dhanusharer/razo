import { Product, CatalogItem } from './types.js';
import catalogData from './catalog.json' with { type: 'json' };

export const CATALOG: readonly CatalogItem[] = Object.freeze(
  (catalogData as CatalogItem[]).map((item) => Object.freeze({ ...item, attributes: Object.freeze({ ...item.attributes }) }))
);

const catalogMap = new Map<string, CatalogItem>();
for (const item of CATALOG) {
  catalogMap.set(item.id, item);
}

export class CatalogService {
  /**
   * Retrieves all products from the authoritative catalog.
   */
  public static getAllProducts(): readonly Product[] {
    return CATALOG.map((item) => this.stripStock(item));
  }

  /**
   * Retrieves raw catalog items including initial default stock metadata.
   */
  public static getCatalogItems(): readonly CatalogItem[] {
    return CATALOG;
  }

  /**
   * Retrieves a product by its unique product ID.
   */
  public static getProduct(id: string): Product | undefined {
    const item = catalogMap.get(id);
    return item ? this.stripStock(item) : undefined;
  }

  /**
   * Retrieves the authoritative price for a product.
   * Ensures prices are always verified against ground-truth catalog, never LLM output.
   */
  public static getAuthoritativePrice(productId: string): { price_inr: number; price_paise: number; currency: string } | undefined {
    const product = catalogMap.get(productId);
    if (!product) return undefined;
    return {
      price_inr: product.price_inr,
      price_paise: product.price_paise,
      currency: product.currency
    };
  }

  /**
   * Retrieves the authoritative cost for a product.
   * Ensures product costs are always verified against ground-truth catalog.
   */
  public static getAuthoritativeCost(productId: string): { cost_inr: number; cost_paise: number; currency: string } | undefined {
    const product = catalogMap.get(productId);
    if (!product || product.cost_inr === undefined || product.cost_paise === undefined) return undefined;
    return {
      cost_inr: product.cost_inr,
      cost_paise: product.cost_paise,
      currency: product.currency
    };
  }

  /**
   * Calculates authoritative margin for a product.
   * margin_inr = price_inr - cost_inr
   */
  public static getAuthoritativeMargin(productId: string): {
    price_inr: number;
    cost_inr: number;
    margin_inr: number;
    margin_paise: number;
    margin_percent: number;
  } | undefined {
    const product = catalogMap.get(productId);
    if (!product || product.cost_inr === undefined || product.cost_paise === undefined) return undefined;
    const margin_inr = product.price_inr - product.cost_inr;
    const margin_paise = product.price_paise - product.cost_paise;
    const margin_percent = Math.round(((margin_inr / product.price_inr) * 100) * 100) / 100;
    return {
      price_inr: product.price_inr,
      cost_inr: product.cost_inr,
      margin_inr,
      margin_paise,
      margin_percent
    };
  }

  /**
   * Checks if a product exists in the catalog.
   */
  public static hasProduct(id: string): boolean {
    return catalogMap.has(id);
  }

  private static stripStock(item: CatalogItem): Product {
    const { initial_stock: _initial_stock, ...product } = item;
    return product;
  }
}
