export type EvidenceLevel = "assessment" | "audit" | "disclosure" | "hiring" | "research";
export type BrandOrigin = "china" | "international" | "unconfirmed";
export type LaborTopic = "contracts" | "pay" | "insurance" | "hours" | "rest" | "protection";
export interface LaborAssessment {
  subject: string;
  result: string;
  period: string;
  sourceId: string;
  limitation: string;
  kind?: "government-labor-rating" | "government-labor-review" | "independent-labor-audit" | "employer-labor-disclosure";
  grade?: "A" | "B" | "C";
  periodStart?: string;
  periodEnd?: string;
  resultPublishedAt?: string;
  resultIssuedAt?: string;
  reviewedAt?: string;
  reviewDueAt?: string;
  status?: "current" | "withdrawn";
  conclusion?: "supported" | "unresolved" | "adverse";
  issuer?: string;
  scope?: string;
  scopeType?: "employer" | "facility";
  facility?: string;
  verificationSourceId?: string;
  basisSourceIds?: string[];
  coverage?: LaborTopic[];
  validUntil?: string;
}
export interface Source {
  id: string;
  title: string;
  publisher: string;
  type: string;
  url: string;
  publishedAt: string | null;
  issuedAt?: string;
  checkedAt: string;
  locator: string;
  summary: string;
  limitation: string;
  publisherVerificationSourceId?: string;
  verifiedPublicationHosts?: string[];
}
export interface SupplyStage {
  stage: string;
  status: "policy" | "unknown" | "verified";
  detail: string;
  sourceIds: string[];
}
export interface EmployeeFeedback {
  sourceId: string;
  kind: "firsthand" | "interview" | "employer-interview" | "repost" | "referral";
  period: string;
  roleScope: string;
  summary: string;
  limitation: string;
}
export interface Company {
  id: string;
  origin: BrandOrigin;
  originNote: string;
  assessments?: LaborAssessment[];
  employeeFeedback?: EmployeeFeedback[];
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
  brandOrigin?: { value: BrandOrigin; note: string; sourceIds: string[] };
  companyId: string;
  manufacturerOptions?: {
    companyId: string;
    subject: string;
    facility?: string;
    sourceIds: string[];
    assessmentSourceId: string;
  }[];
  category: string;
  description: string;
  tags: string[];
  needs: string[];
  image: string | null;
  imageMode: string;
  imageSource: string | null;
  imageRights: string;
  url: string;
  market: string;
  relationship: string;
  relationshipSourceIds: string[];
  admission: {
    chinaSale: AdmissionCheck;
    chinaProduction: AdmissionCheck;
    productionLabor: AdmissionCheck;
  };
}
export interface AdmissionCheck {
  status: "supported" | "pending";
  detail: string;
  sourceIds: string[];
  subject?: string;
  facility?: string;
  assessmentSourceId?: string;
}
export interface Catalog {
  version: number;
  updatedAt: string;
  categories: { id: string; name: string; description: string }[];
  sources: Source[];
  companies: Company[];
  products: Product[];
  coverage: { category: string; needs: { label: string; query: string }[]; note: string; sourceIds: string[] }[];
}
export interface Filters {
  category: string;
  need: string;
  origin: "all" | "china";
  query: string;
  evidence: string;
  supply: boolean;
  saved: boolean;
  sort: string;
}
