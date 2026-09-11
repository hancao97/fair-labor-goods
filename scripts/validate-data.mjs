import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { hasVerifiedChain, isAdmitted, selectAdmittedProducts } from "../src/catalog.mjs";

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
  assert(["disclosure", "hiring", "research"].includes(c.level));
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
  }
  assert(c.caveats.length > 0);
  assert(c.supply.length >= 3);
  for (const s of c.supply) {
    text(s.stage, "stage");
    text(s.detail, "detail");
    refs(s.sourceIds);
    assert(["policy", "unknown", "verified"].includes(s.status));
    if (s.status !== "unknown") assert(s.sourceIds.length > 0);
  }
  if (c.level !== "research") {
    assert(c.hours !== null && c.hours <= 40);
    assert(c.restDays !== null && c.restDays >= 2);
    assert(c.sourceIds.length > 0);
  }
  // A future verification requires a deliberate model extension and independent records.
  assert.equal(
    c.actualHoursVerified,
    false,
    "Independent actual-hours verification not implemented",
  );
  assert.equal(
    c.actualRestVerified,
    false,
    "Independent rest verification not implemented",
  );
  assert(!hasVerifiedChain(c), "Do not certify from self-reported policies");
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
  assert(!isAdmitted(p, data.companies.find((c) => c.id === p.companyId)), "No independent production labor validation has been implemented");
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
assert.equal(selectAdmittedProducts(data).length, 0, "Research records must not appear as admitted products");
const raw = JSON.stringify(data) + JSON.stringify(credits);
assert(
  !/\/Users\/|\/tmp\/|Bearer |ghp_|github_pat_/.test(raw),
  "Private local data must not be published",
);
assert(!/\p{Extended_Pictographic}/u.test(raw), "No emoji in catalog data");
console.log(
  `Validated ${data.products.length} research products, ${data.companies.length} company records, ${data.sources.length} sources and ${categories.size} categories. ${selectAdmittedProducts(data).length} admitted.`,
);
