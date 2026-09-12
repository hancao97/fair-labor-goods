export const defaults = {
  category: "all",
  need: "",
  origin: "all",
  query: "",
  evidence: "all",
  supply: false,
  saved: false,
  sort: "evidence",
};

// Catalog review dates use Beijing time, independently of the visitor's timezone.
const today = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const dated = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

// A government assessment applies to its named employer and assessment period.
// A brand's policies, unknown upstream stages or a weekly schedule alone are not a legal verdict.
export function getLaborAssessment(product, company, onDate = today()) {
  const labor = product.admission?.productionLabor;
  const production = product.admission?.chinaProduction;
  if (!company || product.companyId !== company.id ||
      production?.status !== "supported" || !production.subject?.trim() ||
      labor?.status !== "supported" || !labor.sourceIds?.includes(labor.assessmentSourceId)) return undefined;
  const assessments = (company.assessments || []).filter((a) =>
    a.kind === "government-labor-rating" && a.subject === production.subject,
  );
  return assessments.find((a) =>
    a.sourceId === labor.assessmentSourceId && a.grade === "A" && a.status === "current" &&
    [a.periodStart, a.periodEnd, a.reviewedAt, a.reviewDueAt, onDate].every(dated) &&
    a.periodStart <= a.periodEnd && a.periodEnd <= a.reviewedAt &&
    a.reviewedAt <= onDate && onDate < a.reviewDueAt &&
    !assessments.some((newer) => newer.periodEnd > a.periodEnd ||
      (newer.periodEnd === a.periodEnd && newer.sourceId !== a.sourceId && newer.reviewedAt >= a.reviewedAt)),
  );
}
export function isAdmitted(product, company, onDate = today()) {
  const checks = product.admission;
  return Boolean(checks && company &&
    [checks.chinaSale, checks.chinaProduction, checks.productionLabor].every(
      (check) => check?.status === "supported" && check.sourceIds?.length > 0,
    ) && getLaborAssessment(product, company, onDate)
  );
}
export function selectAdmittedProducts(data, onDate = today()) {
  const companies = new Map(data.companies.map((c) => [c.id, c]));
  return data.products.filter((p) => isAdmitted(p, companies.get(p.companyId), onDate));
}
export function getCatalogAvailability(data, filters, onDate = today()) {
  // Keep the consumer's category, need, brand origin and search when explaining an empty result.
  const scopeFilters = { ...filters, evidence: "all", supply: false, saved: false };
  const companies = new Map(data.companies.map((c) => [c.id, c]));
  const matching = selectProducts(data, scopeFilters);
  const pending = matching.filter((p) => !isAdmitted(p, companies.get(p.companyId), onDate));
  const gaps = { chinaSale: 0, chinaProduction: 0, productionLabor: 0 };
  for (const product of pending) {
    for (const key of Object.keys(gaps)) {
      const check = product.admission?.[key];
      if (check?.status !== "supported" || !check.sourceIds?.length ||
          (key === "productionLabor" && !getLaborAssessment(product, companies.get(product.companyId), onDate))) {
        gaps[key]++;
      }
    }
  }
  return { filters: scopeFilters, admittedCount: matching.length - pending.length, pendingCount: pending.length, gaps };
}
export function hasVerifiedChain(company) {
  return (
    Array.isArray(company.supply) && company.supply.length >= 3 &&
    company.supply.every(
      (s) => s.status === "verified" && s.sourceIds.length > 0,
    )
  );
}
export function selectProducts(data, filters, savedIds = []) {
  const query = filters.query.normalize("NFKC").trim().toLocaleLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const companies = new Map(data.companies.map((c) => [c.id, c]));
  const selected = data.products.filter((p) => {
    const c = companies.get(p.companyId);
    const haystack = [
      p.name,
      p.brand,
      p.description,
      ...p.tags,
      c.name,
      c.legalName,
    ]
      .join(" ")
      .normalize("NFKC")
      .toLocaleLowerCase();
    return (
      (filters.category === "all" || p.category === filters.category) &&
      (!filters.need || p.needs?.includes(filters.need)) &&
      (filters.origin !== "china" || c.origin === "china") &&
      words.every((w) => haystack.includes(w)) &&
      (filters.evidence === "all" || c.level === filters.evidence) &&
      (!filters.supply || hasVerifiedChain(c)) &&
      (!filters.saved || savedIds.includes(p.id))
    );
  });
  if (filters.sort === "name")
    return selected.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const priority = { assessment: 0, disclosure: 1, hiring: 2, research: 3 };
  return selected.sort(
    (a, b) =>
      priority[companies.get(a.companyId).level] -
      priority[companies.get(b.companyId).level],
  );
}
export function readFilters(search, categoryIds) {
  const p = new URLSearchParams(search);
  return {
    category: categoryIds.includes(p.get("category"))
      ? p.get("category")
      : "all",
    query: (p.get("q") || "").slice(0, 200),
    need: (p.get("need") || "").slice(0, 50),
    origin: p.get("origin") === "china" ? "china" : "all",
    evidence: ["assessment", "disclosure", "hiring", "research"].includes(p.get("evidence"))
      ? p.get("evidence")
      : "all",
    supply: p.get("supply") === "verified",
    saved: p.get("saved") === "1",
    sort: p.get("sort") === "name" ? "name" : "evidence",
  };
}
export function writeFilters(filters) {
  const p = new URLSearchParams();
  if (filters.category !== "all") p.set("category", filters.category);
  if (filters.query) p.set("q", filters.query);
  if (filters.need) p.set("need", filters.need);
  if (filters.origin === "china") p.set("origin", "china");
  if (filters.evidence !== "all") p.set("evidence", filters.evidence);
  if (filters.supply) p.set("supply", "verified");
  if (filters.saved) p.set("saved", "1");
  if (filters.sort !== "evidence") p.set("sort", filters.sort);
  return p.toString();
}
