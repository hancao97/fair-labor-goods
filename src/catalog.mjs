export const defaults = {
  category: "all",
  query: "",
  evidence: "all",
  supply: false,
  saved: false,
  sort: "evidence",
};

// Published policies and audits of suppliers are not proof of actual weekly schedules.
export function hasVerifiedChain(company) {
  return (
    company.actualHoursVerified === true &&
    company.actualRestVerified === true &&
    typeof company.hours === "number" &&
    company.hours <= 40 &&
    typeof company.restDays === "number" &&
    company.restDays >= 2 &&
    company.supply.length >= 3 &&
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
      words.every((w) => haystack.includes(w)) &&
      (filters.evidence === "all" || c.level === filters.evidence) &&
      (!filters.supply || hasVerifiedChain(c)) &&
      (!filters.saved || savedIds.includes(p.id))
    );
  });
  if (filters.sort === "name")
    return selected.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const priority = { disclosure: 0, hiring: 1, research: 2 };
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
    evidence: ["disclosure", "hiring", "research"].includes(p.get("evidence"))
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
  if (filters.evidence !== "all") p.set("evidence", filters.evidence);
  if (filters.supply) p.set("supply", "verified");
  if (filters.saved) p.set("saved", "1");
  if (filters.sort !== "evidence") p.set("sort", filters.sort);
  return p.toString();
}
