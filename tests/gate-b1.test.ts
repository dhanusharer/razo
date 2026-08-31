import { describe, it, expect, beforeEach } from 'vitest';
import {
  CatalogService,
  CATALOG,
  InventorySimulator,
  inventorySimulator,
  createUserMandate,
  DEFAULT_TEST_MANDATE,
  getCandidateProducts,
  CandidateRetrieval
} from '../src/commerce/index.js';

describe('GATE B1 — Local Commerce State & Candidate Retrieval', () => {
  beforeEach(() => {
    inventorySimulator.reset();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B1.1: Curated 6-product catalog structure
  // ─────────────────────────────────────────────────────────────
  describe('TEST B1.1 — Curated 6-product catalog', () => {
    it('should contain exactly 6 products in catalog', () => {
      const products = CatalogService.getAllProducts();
      expect(products.length).toBe(6);
      expect(CATALOG.length).toBe(6);
    });

    it('should contain the exact specified products and properties', () => {
      const original = CatalogService.getProduct('ADIDAS-RUN-01');
      expect(original).toBeDefined();
      expect(original?.name).toBe('Adidas Boston 12');
      expect(original?.brand).toBe('Adidas');
      expect(original?.category).toBe('running_shoes');
      expect(original?.price_inr).toBe(4900);
      expect(original?.price_paise).toBe(490000);
      expect(original?.attributes.size).toBe(10);

      const cand1 = CatalogService.getProduct('ADIDAS-RUN-02');
      expect(cand1).toBeDefined();
      expect(cand1?.name).toBe('Adidas Adizero SL2');
      expect(cand1?.price_inr).toBe(5200);
      expect(cand1?.attributes.size).toBe(10);

      const cand2 = CatalogService.getProduct('ADIDAS-RUN-03');
      expect(cand2).toBeDefined();
      expect(cand2?.name).toBe('Adidas Prime X');
      expect(cand2?.price_inr).toBe(5500);

      const cand3 = CatalogService.getProduct('NIKE-RUN-01');
      expect(cand3).toBeDefined();
      expect(cand3?.brand).toBe('Nike');
      expect(cand3?.price_inr).toBe(4800);

      const cand4 = CatalogService.getProduct('ADIDAS-RUN-04');
      expect(cand4).toBeDefined();
      expect(cand4?.attributes.size).toBe(9);
      expect(cand4?.price_inr).toBe(4700);

      const cand5 = CatalogService.getProduct('ADIDAS-RUN-05');
      expect(cand5).toBeDefined();
      expect(cand5?.name).toBe('Adidas Supernova');
      expect(cand5?.price_inr).toBe(5100);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B1.2: Authoritative catalog prices
  // ─────────────────────────────────────────────────────────────
  describe('TEST B1.2 — Authoritative catalog price lookups', () => {
    it('provides ground-truth prices independently of external input', () => {
      const price = CatalogService.getAuthoritativePrice('ADIDAS-RUN-01');
      expect(price).toEqual({
        price_inr: 4900,
        price_paise: 490000,
        currency: 'INR'
      });

      const cand2Price = CatalogService.getAuthoritativePrice('ADIDAS-RUN-03');
      expect(cand2Price?.price_inr).toBe(5500);
      expect(cand2Price?.price_paise).toBe(550000);

      const nonExistent = CatalogService.getAuthoritativePrice('UNKNOWN-ITEM');
      expect(nonExistent).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B1.3: Deterministic inventory simulator & OOS injection
  // ─────────────────────────────────────────────────────────────
  describe('TEST B1.3 — Deterministic inventory simulator', () => {
    it('original product is initially in stock', () => {
      expect(inventorySimulator.isAvailable('ADIDAS-RUN-01')).toBe(true);
      expect(inventorySimulator.getStock('ADIDAS-RUN-01')).toBe(5);
    });

    it('ADIDAS-RUN-05 is initially OUT OF STOCK (stock 0)', () => {
      expect(inventorySimulator.isAvailable('ADIDAS-RUN-05')).toBe(false);
      expect(inventorySimulator.getStock('ADIDAS-RUN-05')).toBe(0);
    });

    it('injects OOS deterministically via setStock(id, 0)', () => {
      inventorySimulator.setStock('ADIDAS-RUN-01', 0);
      expect(inventorySimulator.isAvailable('ADIDAS-RUN-01')).toBe(false);
      expect(inventorySimulator.getStock('ADIDAS-RUN-01')).toBe(0);
    });

    it('toggles OOS deterministically via toggleOOS', () => {
      // Initially in stock (5)
      expect(inventorySimulator.getStock('ADIDAS-RUN-01')).toBe(5);

      // Toggle to OOS (0)
      const state1 = inventorySimulator.toggleOOS('ADIDAS-RUN-01');
      expect(state1).toBe(false);
      expect(inventorySimulator.getStock('ADIDAS-RUN-01')).toBe(0);
      expect(inventorySimulator.isAvailable('ADIDAS-RUN-01')).toBe(false);

      // Toggle back to in stock
      const state2 = inventorySimulator.toggleOOS('ADIDAS-RUN-01');
      expect(state2).toBe(true);
      expect(inventorySimulator.getStock('ADIDAS-RUN-01')).toBeGreaterThan(0);
      expect(inventorySimulator.isAvailable('ADIDAS-RUN-01')).toBe(true);
    });

    it('supports isolated simulator instances for deterministic testing', () => {
      const isolated = new InventorySimulator();
      isolated.setStock('ADIDAS-RUN-02', 10);
      expect(isolated.getStock('ADIDAS-RUN-02')).toBe(10);
      expect(inventorySimulator.getStock('ADIDAS-RUN-02')).toBe(4);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B1.4: Candidate retrieval
  // ─────────────────────────────────────────────────────────────
  describe('TEST B1.4 — Candidate retrieval', () => {
    it('returns all 5 alternative candidates when original product is unavailable', () => {
      const candidates = getCandidateProducts('ADIDAS-RUN-01');
      expect(candidates.length).toBe(5);

      const candidateIds = candidates.map((c) => c.id);
      expect(candidateIds).not.toContain('ADIDAS-RUN-01');
      expect(candidateIds).toContain('ADIDAS-RUN-02');
      expect(candidateIds).toContain('ADIDAS-RUN-03');
      expect(candidateIds).toContain('NIKE-RUN-01');
      expect(candidateIds).toContain('ADIDAS-RUN-04');
      expect(candidateIds).toContain('ADIDAS-RUN-05');
    });

    it('filters out OOS candidates when onlyInStock is requested', () => {
      const inStockCandidates = CandidateRetrieval.getCandidates('ADIDAS-RUN-01', { onlyInStock: true });
      expect(inStockCandidates.length).toBe(4);

      const candidateIds = inStockCandidates.map((c) => c.id);
      expect(candidateIds).not.toContain('ADIDAS-RUN-05'); // Stock is 0
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B1.5: UserMandate model and immutability
  // ─────────────────────────────────────────────────────────────
  describe('TEST B1.5 — UserMandate model immutability', () => {
    it('creates frozen immutable mandate instance', () => {
      const mandate = createUserMandate({
        max_budget: 5500,
        allowed_categories: ['running_shoes'],
        allowed_brands: ['Adidas'],
        max_price_delta_percent: 10,
        required_attributes: { size: 10 }
      });

      expect(Object.isFrozen(mandate)).toBe(true);
      expect(Object.isFrozen(mandate.allowed_categories)).toBe(true);
      expect(Object.isFrozen(mandate.allowed_brands)).toBe(true);
      expect(Object.isFrozen(mandate.required_attributes)).toBe(true);

      // Mutating frozen properties throws in strict mode
      expect(() => {
        (mandate as any).max_budget = 9000;
      }).toThrow();

      expect(() => {
        (mandate.allowed_brands as any).push('Nike');
      }).toThrow();

      expect(() => {
        (mandate.required_attributes as any).size = 11;
      }).toThrow();
    });

    it('default test mandate has exact specified values', () => {
      expect(DEFAULT_TEST_MANDATE.max_budget).toBe(5500);
      expect(DEFAULT_TEST_MANDATE.allowed_categories).toEqual(['running_shoes']);
      expect(DEFAULT_TEST_MANDATE.allowed_brands).toEqual(['Adidas']);
      expect(DEFAULT_TEST_MANDATE.max_price_delta_percent).toBe(10);
      expect(DEFAULT_TEST_MANDATE.required_attributes).toEqual({ size: 10 });
    });
  });
});
