import { CATALOG } from './catalog.js';

export class InventorySimulator {
  private stockMap: Map<string, number> = new Map();

  constructor() {
    this.reset();
  }

  /**
   * Resets all stock counts to the initial values defined in the catalog.
   */
  public reset(): void {
    this.stockMap.clear();
    for (const item of CATALOG) {
      this.stockMap.set(item.id, item.initial_stock);
    }
  }

  /**
   * Sets the deterministic stock count for a given product ID.
   */
  public setStock(productId: string, count: number): void {
    if (count < 0) {
      throw new Error(`Stock count cannot be negative: ${count}`);
    }
    this.stockMap.set(productId, count);
  }

  /**
   * Toggles product stock between Out-Of-Stock (0) and in-stock (restores default stock or 5).
   * Returns true if product is now in-stock, false if now out-of-stock.
   */
  public toggleOOS(productId: string): boolean {
    const current = this.getStock(productId);
    if (current > 0) {
      this.setStock(productId, 0);
      return false;
    } else {
      const defaultItem = CATALOG.find((item) => item.id === productId);
      const restoreCount = defaultItem && defaultItem.initial_stock > 0 ? defaultItem.initial_stock : 5;
      this.setStock(productId, restoreCount);
      return true;
    }
  }

  /**
   * Gets the current stock level for a product.
   */
  public getStock(productId: string): number {
    return this.stockMap.get(productId) ?? 0;
  }

  /**
   * Checks if requested quantity is available in stock.
   */
  public isAvailable(productId: string, quantity: number = 1): boolean {
    return this.getStock(productId) >= quantity;
  }

  /**
   * Returns a snapshot of all current inventory levels.
   */
  public getSnapshot(): Record<string, number> {
    const snapshot: Record<string, number> = {};
    for (const [id, count] of this.stockMap.entries()) {
      snapshot[id] = count;
    }
    return snapshot;
  }
}

export const inventorySimulator = new InventorySimulator();
