import type { Catalog, Company, Product, Filters } from "./types";
export const defaults: Filters;
export function isAdmitted(product: Product, company: Company): boolean;
export function selectAdmittedProducts(data: Catalog): Product[];
export function hasVerifiedChain(company: Company): boolean;
export function selectProducts(
  data: Catalog,
  filters: Filters,
  savedIds?: string[],
): Product[];
export function readFilters(search: string, categoryIds: string[]): Filters;
export function writeFilters(filters: Filters): string;
