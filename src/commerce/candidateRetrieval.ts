import { Product, CandidateRetrievalOptions } from './types.js';
import { CatalogService } from './catalog.js';
import { inventorySimulator, InventorySimulator } from './inventorySimulator.js';

export class CandidateRetrieval {
  /**
   * Retrieves candidate alternative products for a given original product.
   * By default, excludes the original product and returns all catalog alternatives.
   */
  public static getCandidates(
    originalProductId: string,
    options: CandidateRetrievalOptions & { inventory?: InventorySimulator } = {}
  ): Product[] {
    const allProducts = CatalogService.getAllProducts();
    const inv = options.inventory ?? inventorySimulator;

    return allProducts.filter((product) => {
      // Exclude original product unless explicitly requested
      if (options.excludeOriginal !== false && product.id === originalProductId) {
        return false;
      }

      // Filter by stock if requested
      if (options.onlyInStock && !inv.isAvailable(product.id, 1)) {
        return false;
      }

      return true;
    });
  }
}

export function getCandidateProducts(
  originalProductId: string,
  options?: CandidateRetrievalOptions & { inventory?: InventorySimulator }
): Product[] {
  return CandidateRetrieval.getCandidates(originalProductId, options);
}
