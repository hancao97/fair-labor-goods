import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { getLaborAssessment, selectAdmittedProducts } from "../src/catalog.mjs";

const data = JSON.parse(
  await readFile(new URL("../public/data/catalog.json", import.meta.url)),
);
const credits = JSON.parse(
  await readFile(new URL("../public/data/image-credits.json", import.meta.url)),
);
const unique = (items, label) => {
  const ids = items.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, `${label}: duplicate ID`);
  assert(
    ids.every((id) => /^[a-z0-9-]+$/.test(id)),
    `${label}: invalid ID`,
  );
  return new Set(ids);
};
const sourceIds = unique(data.sources, "sources");
const companyIds = unique(data.companies, "companies");
const categories = unique(data.categories, "categories");
unique(data.products, "products");
const text = (value, label) =>
  assert(typeof value === "string" && value.trim().length > 0, label);
const refs = (ids) => {
  assert(Array.isArray(ids));
  ids.forEach((id) => assert(sourceIds.has(id), `Missing source ${id}`));
};
const date = (value) =>
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)),
    `Invalid date ${value}`,
  );
const url = (value) => {
  const u = new URL(value);
  assert(["https:", "http:"].includes(u.protocol), "Public web source only");
  assert(!u.username && !u.password, "No URL credentials");
};
date(data.updatedAt);
assert.equal(
  categories.size,
  15,
  "The everyday research map must include all 15 areas",
);
for (const s of data.sources) {
  ["title", "publisher", "type", "locator", "summary", "limitation"].forEach(
    (k) => text(s[k], `${s.id}.${k}`),
  );
  url(s.url);
  date(s.checkedAt);
  if (s.publishedAt) {
    date(s.publishedAt);
    assert(s.publishedAt <= s.checkedAt, "Publication cannot be in the future");
  }
  assert(s.checkedAt <= data.updatedAt);
}
for (const c of data.companies) {
  assert(["china", "international", "unconfirmed"].includes(c.origin));
  text(c.originNote, `${c.id}.originNote`);
  assert(["assessment", "disclosure", "hiring", "research"].includes(c.level));
  [
    "name",
    "legalName",
    "location",
    "hoursLabel",
    "restLabel",
    "cardNote",
    "scope",
    "finding",
    "nextCheck",
  ].forEach((k) => text(c[k], `${c.id}.${k}`));
  refs(c.sourceIds);
  for (const assessment of c.assessments || []) {
    ["subject", "result", "period", "limitation"].forEach((key) => text(assessment[key], `${c.id}.assessment.${key}`));
    refs([assessment.sourceId]);
    if (assessment.kind) {
      assert.equal(assessment.kind, "government-labor-rating");
      assert(["A", "B", "C"].includes(assessment.grade));
      assert(["current", "withdrawn"].includes(assessment.status));
      for (const key of ["periodStart", "periodEnd", "reviewedAt", "reviewDueAt"]) date(assessment[key]);
      assert(assessment.periodStart <= assessment.periodEnd);
      assert(assessment.periodEnd <= assessment.reviewedAt);
      assert(assessment.reviewedAt <= data.updatedAt);
      assert(assessment.reviewDueAt > assessment.reviewedAt);
      const source = data.sources.find((s) => s.id === assessment.sourceId);
      assert.equal(source.type, "政府评价");
      assert(new URL(source.url).hostname.endsWith(".gov.cn"));
      assert(source.publishedAt && source.publishedAt <= assessment.reviewedAt);
    }
  }
  if (c.level === "assessment") assert(c.assessments?.some((a) => a.kind === "government-labor-rating"));
  assert(c.caveats.length > 0);
  assert(c.supply.length >= 3);
  for (const s of c.supply) {
    text(s.stage, "stage");
    text(s.detail, "detail");
    refs(s.sourceIds);
    assert(["policy", "unknown", "verified"].includes(s.status));
    if (s.status !== "unknown") assert(s.sourceIds.length > 0);
  }
  if (c.level !== "research") assert(c.sourceIds.length > 0);
  assert(c.hours === null || (Number.isFinite(c.hours) && c.hours >= 0));
  assert(c.restDays === null || (Number.isFinite(c.restDays) && c.restDays >= 0 && c.restDays <= 7));
  assert.equal(typeof c.actualHoursVerified, "boolean");
  assert.equal(typeof c.actualRestVerified, "boolean");
}
for (const p of data.products) {
  assert(companyIds.has(p.companyId));
  assert(categories.has(p.category));
  assert(Array.isArray(p.needs));
  const allowedNeeds = data.coverage.find((c) => c.category === p.category)?.needs.map((n) => n.label) || [];
  p.needs.forEach((need) => assert(allowedNeeds.includes(need), `${p.id}: invalid need ${need}`));
  ["name", "brand", "description", "market", "relationship"].forEach((k) =>
    text(p[k], `${p.id}.${k}`),
  );
  url(p.url);
  refs(p.relationshipSourceIds);
  assert(p.relationshipSourceIds.length > 0);
  for (const key of ["chinaSale", "chinaProduction", "productionLabor"]) {
    const check = p.admission?.[key];
    assert(check, `${p.id}: missing admission check ${key}`);
    assert(["supported", "pending"].includes(check.status));
    text(check.detail, `${p.id}.${key}.detail`);
    refs(check.sourceIds);
    if (check.status === "supported") assert(check.sourceIds.length > 0, `${p.id}: unsupported admission claim`);
  }
  if (p.admission.productionLabor.status === "supported") {
    assert(getLaborAssessment(p, data.companies.find((c) => c.id === p.companyId), data.updatedAt),
      `${p.id}: labor evidence must match the producer and a current, dated government A rating`);
  }
  if (p.image) {
    assert(/^images\/[a-z0-9-]+\.webp$/.test(p.image));
    await access(new URL("../public/" + p.image, import.meta.url));
    const credit = credits.assets.find((a) => a.id === p.id);
    assert(credit, `${p.id}: missing attribution`);
    assert.equal(credit.image_url, p.imageSource);
    url(p.imageSource);
    text(p.imageRights, "image rights");
  } else assert.equal(p.imageSource, null);
}
for (const id of categories) assert(data.coverage.some((c) => c.category === id), `Missing research coverage for ${id}`);
assert.equal(new Set(data.coverage.map((c) => c.category)).size, data.coverage.length, "Duplicate coverage category");
for (const coverage of data.coverage) {
  assert(categories.has(coverage.category));
  text(coverage.note, `${coverage.category}.coverage.note`);
  refs(coverage.sourceIds);
  assert(coverage.needs.length > 0);
  assert.equal(new Set(coverage.needs.map((n) => n.label)).size, coverage.needs.length);
  for (const need of coverage.needs) {
    text(need.label, `${coverage.category}.need.label`);
    text(need.query, `${coverage.category}.need.query`);
  }
}
const raw = JSON.stringify(data) + JSON.stringify(credits);
assert(
  !/\/Users\/|\/tmp\/|Bearer |ghp_|github_pat_/.test(raw),
  "Private local data must not be published",
);
assert(!/\p{Extended_Pictographic}/u.test(raw), "No emoji in catalog data");
console.log(
  `Validated ${data.products.length} product records, ${data.companies.length} company records, ${data.sources.length} sources and ${categories.size} categories. ${selectAdmittedProducts(data, data.updatedAt).length} admitted at review date.`,
);
