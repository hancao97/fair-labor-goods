export type EvidenceLevel = "disclosure" | "hiring" | "research";
export interface Source {
  id: string;
  title: string;
  publisher: string;
  type: string;
  url: string;
  publishedAt: string | null;
  checkedAt: string;
  locator: string;
  summary: string;
  limitation: string;
}
export interface SupplyStage {
  stage: string;
  status: "policy" | "unknown" | "verified";
  detail: string;
  sourceIds: string[];
}
export interface Company {
  id: string;
  name: string;
  legalName: string;
  location: string;
  level: EvidenceLevel;
  hours: number | null;
  restDays: number | null;
  hoursLabel: string;
  restLabel: string;
  cardNote: string;
  scope: string;
  finding: string;
  caveats: string[];
  sourceIds: string[];
  supply: SupplyStage[];
  actualHoursVerified: boolean;
  actualRestVerified: boolean;
  nextCheck: string;
}
export interface Product {
  id: string;
  name: string;
  brand: string;
  companyId: string;
  category: string;
  description: string;
  tags: string[];
  image: string | null;
  imageMode: string;
  imageSource: string | null;
  imageRights: string;
  url: string;
  market: string;
  relationship: string;
  relationshipSourceIds: string[];
}
export interface Catalog {
  version: number;
  updatedAt: string;
  categories: { id: string; name: string; description: string }[];
  sources: Source[];
  companies: Company[];
  products: Product[];
}
export interface Filters {
  category: string;
  query: string;
  evidence: string;
  supply: boolean;
  saved: boolean;
  sort: string;
}
