import type { Catalog, Company, Product, Filters, LaborAssessment } from "./types";
export const defaults: Filters;
export function getLaborAssessment(product: Product, company: Company, onDate?: string): LaborAssessment | undefined;
export function isAdmitted(product: Product, company: Company, onDate?: string): boolean;
export function selectAdmittedProducts(data: Catalog, onDate?: string): Product[];
export function getCatalogAvailability(data: Catalog, filters: Filters, onDate?: string): {
  filters: Filters;
  admittedCount: number;
  pendingCount: number;
  gaps: Record<"chinaSale" | "chinaProduction" | "productionLabor", number>;
};
export function hasVerifiedChain(company: Company): boolean;
export function selectProducts(
  data: Catalog,
  filters: Filters,
  savedIds?: string[],
): Product[];
export function readFilters(search: string, categoryIds: string[]): Filters;
export function writeFilters(filters: Filters): string;
