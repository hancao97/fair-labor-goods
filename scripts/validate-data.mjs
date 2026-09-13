import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { getLaborAssessments, hasSupportingLaborEvidence, hasValidLaborAssessmentDates, laborTopics, selectAdmittedProducts } from "../src/catalog.mjs";
import { validateGovernmentPublicationSource, validateLaborEvidenceSources } from "./labor-evidence-sources.mjs";

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
for (const id of [
  "food", "fresh", "drinks", "clothing", "home", "kitchen", "daily",
  "electronics", "appliances", "stationery", "transport", "cars",
  "housing", "dining", "culture", "games",
]) assert(categories.has(id), `Missing everyday research area ${id}`);
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
  if (s.issuedAt !== undefined) {
    date(s.issuedAt);
    assert(["独立劳动审计", "社会责任认证记录"].includes(s.type));
    assert(s.issuedAt <= s.checkedAt, "Certification cannot be issued in the future");
    if (s.publishedAt) assert(s.issuedAt <= s.publishedAt, "A result cannot be published before it is issued");
  }
  assert(s.checkedAt <= data.updatedAt);
  if (s.verifiedPublicationHosts !== undefined) {
    assert.equal(s.type, "发布机构核验");
    assert(new URL(s.url).hostname.endsWith(".gov.cn"));
    assert(Array.isArray(s.verifiedPublicationHosts) && s.verifiedPublicationHosts.length > 0);
    assert.equal(new Set(s.verifiedPublicationHosts).size, s.verifiedPublicationHosts.length);
    for (const host of s.verifiedPublicationHosts) {
      text(host, `${s.id}.verifiedPublicationHosts`);
      assert.equal(new URL(`https://${host}`).host, host, "Use an exact publication host without wildcards or paths");
      assert(!host.includes("*") && !host.includes(":"));
    }
  }
  if (s.publisherVerificationSourceId !== undefined) {
    refs([s.publisherVerificationSourceId]);
    validateGovernmentPublicationSource(s, data.sources);
  }
}
for (const c of data.companies) {
  assert(["china", "international", "unconfirmed"].includes(c.origin));
  text(c.originNote, `${c.id}.originNote`);
  assert(["assessment", "audit", "disclosure", "hiring", "research"].includes(c.level));
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
  const feedbackIds = new Set();
  for (const feedback of c.employeeFeedback || []) {
    refs([feedback.sourceId]);
    assert(!feedbackIds.has(feedback.sourceId), `${c.id}: repeated employee feedback source`);
    feedbackIds.add(feedback.sourceId);
    assert(["firsthand", "interview", "employer-interview", "repost", "referral"].includes(feedback.kind));
    for (const key of ["period", "roleScope", "summary", "limitation"]) text(feedback[key], `${c.id}.employeeFeedback.${key}`);
  }
  for (const assessment of c.assessments || []) {
    ["subject", "result", "period", "limitation"].forEach((key) => text(assessment[key], `${c.id}.assessment.${key}`));
    refs([assessment.sourceId]);
    if (assessment.kind) {
      assert(["government-labor-rating", "government-labor-review", "independent-labor-audit", "employer-labor-disclosure"].includes(assessment.kind));
      if (assessment.kind === "government-labor-rating") {
        assert(["A", "B", "C"].includes(assessment.grade));
      } else {
        assert(["supported", "unresolved", "adverse"].includes(assessment.conclusion));
        if (assessment.kind === "employer-labor-disclosure") assert.equal(assessment.conclusion, "adverse");
        for (const key of ["issuer", "scope", "verificationSourceId"]) text(assessment[key], `${c.id}.assessment.${key}`);
        assert(["employer", "facility"].includes(assessment.scopeType));
        if (assessment.scopeType === "facility") text(assessment.facility, `${c.id}.assessment.facility`);
        refs([assessment.verificationSourceId]);
        refs(assessment.basisSourceIds);
        assert(assessment.basisSourceIds.length > 0);
        assert(Array.isArray(assessment.coverage));
        assert(new Set(assessment.coverage).size === assessment.coverage.length);
        assessment.coverage.forEach(topic => assert(Object.hasOwn(laborTopics, topic)));
        if (assessment.conclusion === "supported") assert(hasSupportingLaborEvidence(assessment), `${c.id}: incomplete labor review`);
      }
      assert(["current", "withdrawn"].includes(assessment.status));
      assert(hasValidLaborAssessmentDates(assessment), `${c.id}: invalid labor assessment dates`);
      assert(assessment.reviewedAt <= data.updatedAt);
      assert(assessment.reviewDueAt > assessment.reviewedAt);
      if (assessment.validUntil !== undefined) {
        date(assessment.validUntil);
        assert(assessment.validUntil >= (assessment.periodEnd ?? assessment.resultIssuedAt ?? assessment.resultPublishedAt));
      }
      validateLaborEvidenceSources(assessment, data.sources);
    }
  }
  if (c.level === "assessment") assert(c.assessments?.some((a) => ["government-labor-rating", "government-labor-review"].includes(a.kind)));
  if (c.level === "audit") assert(c.assessments?.some((a) => a.kind === "independent-labor-audit"));
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
  if (p.manufacturerOptions !== undefined) {
    assert(Array.isArray(p.manufacturerOptions) && p.manufacturerOptions.length >= 2);
    assert.equal(new Set(p.manufacturerOptions.map(m => `${m.companyId}\n${m.subject}\n${m.facility || ""}`)).size, p.manufacturerOptions.length);
    assert(p.manufacturerOptions.some(m => m.companyId === p.companyId));
    assert.equal(p.admission.chinaProduction.subject, undefined, "Do not mix a single producer with manufacturer options");
    assert.equal(p.admission.productionLabor.assessmentSourceId, undefined, "Use each manufacturer's assessment");
    for (const maker of p.manufacturerOptions) {
      assert(companyIds.has(maker.companyId));
      text(maker.subject, `${p.id}.manufacturer.subject`);
      if (maker.facility !== undefined) text(maker.facility, `${p.id}.manufacturer.facility`);
      refs(maker.sourceIds);
      assert(maker.sourceIds.length > 0);
      assert(maker.sourceIds.every(id => p.admission.chinaProduction.sourceIds.includes(id)));
      refs([maker.assessmentSourceId]);
      assert(p.admission.productionLabor.sourceIds.includes(maker.assessmentSourceId));
    }
  }
  if (p.brandOrigin !== undefined) {
    assert(["china", "international", "unconfirmed"].includes(p.brandOrigin?.value), `${p.id}: invalid brand origin`);
    text(p.brandOrigin.note, `${p.id}.brandOrigin.note`);
    refs(p.brandOrigin.sourceIds);
    assert(p.brandOrigin.sourceIds.length > 0, `${p.id}: brand origin requires sources`);
  }
  for (const key of ["chinaSale", "chinaProduction", "productionLabor"]) {
    const check = p.admission?.[key];
    assert(check, `${p.id}: missing admission check ${key}`);
    assert(["supported", "pending"].includes(check.status));
    text(check.detail, `${p.id}.${key}.detail`);
    refs(check.sourceIds);
    if (check.status === "supported") assert(check.sourceIds.length > 0, `${p.id}: unsupported admission claim`);
  }
  if (p.admission.productionLabor.status === "supported") {
    assert(getLaborAssessments(p, data.companies, data.updatedAt).length > 0,
      `${p.id}: labor evidence must match the producer, facility scope and a current, supported labor review`);
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
