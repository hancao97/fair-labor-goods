import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  defaults,
  hasVerifiedChain,
  selectProducts,
  readFilters,
  writeFilters,
  isAdmitted,
  selectAdmittedProducts,
  getCatalogAvailability,
} from "../src/catalog.mjs";
const data = JSON.parse(
  await readFile(new URL("../public/data/catalog.json", import.meta.url)),
);
const REVIEW_DATE = "2026-09-12";
function assessedProduct() {
  const company = {
    ...structuredClone(data.companies[0]),
    hours: null, restDays: null,
    actualHoursVerified: false, actualRestVerified: false,
    assessments: [{
      kind: "government-labor-rating", subject: "示例境内制造厂有限公司",
      sourceId: "official-rating", grade: "A", status: "current",
      periodStart: "2025-01-01", periodEnd: "2025-12-31",
      reviewedAt: REVIEW_DATE, reviewDueAt: "2027-06-03",
    }],
  };
  const product = {
    ...structuredClone(data.products[0]), companyId: company.id,
    admission: {
      chinaSale: { status: "supported", sourceIds: ["retail-product"] },
      chinaProduction: { status: "supported", subject: "示例境内制造厂有限公司", sourceIds: ["manufacturer-record"] },
      productionLabor: { status: "supported", sourceIds: ["official-rating"], assessmentSourceId: "official-rating" },
    },
  };
  return { company, product };
}
test("a scoped government A rating admits a domestic product without 40-hour, double-rest or full-chain prerequisites", () => {
  const { product, company } = assessedProduct();
  assert.equal(hasVerifiedChain(company), false);
  assert.equal(isAdmitted(product, company, REVIEW_DATE), true);
  // These descriptive numbers alone cannot establish or contradict legal compliance.
  assert.equal(isAdmitted(product, { ...company, hours: 44, restDays: 1 }, REVIEW_DATE), true);
});
test("every domestic admission condition still requires its own supporting sources", () => {
  const { product, company } = assessedProduct();
  for (const key of Object.keys(product.admission)) {
    for (const change of [{ status: "pending" }, { sourceIds: [] }]) {
      const candidate = structuredClone(product);
      Object.assign(candidate.admission[key], change);
      assert.equal(isAdmitted(candidate, company, REVIEW_DATE), false);
    }
    const candidate = structuredClone(product);
    delete candidate.admission[key];
    assert.equal(isAdmitted(candidate, company, REVIEW_DATE), false);
  }
});
test("a parent or sibling factory rating cannot certify another manufacturer", () => {
  const { product, company } = assessedProduct();
  product.admission.chinaProduction.subject = "另一家代工厂有限公司";
  assert.equal(isAdmitted(product, company, REVIEW_DATE), false);
  assert.equal(isAdmitted(product, undefined, REVIEW_DATE), false);
  product.companyId = "different-brand";
  assert.equal(isAdmitted(product, company, REVIEW_DATE), false);
});
test("a shop listing, recruiting promise or company policy cannot be relabelled as government evidence", () => {
  for (const change of [{ kind: undefined }, { kind: "hiring" }, { grade: "B" }, { grade: "C" }, { sourceId: "different-source" }]) {
    const { product, company } = assessedProduct();
    Object.assign(company.assessments[0], change);
    assert.equal(isAdmitted(product, company, REVIEW_DATE), false);
  }
});
test("withdrawn, superseded and overdue assessments return products to research", () => {
  const { product, company } = assessedProduct();
  assert.equal(isAdmitted(product, company, "2026-09-11"), false);
  assert.equal(isAdmitted(product, company, "2027-06-03"), false);
  assert.equal(isAdmitted(product, company, "2027-06-04"), false);
  company.assessments[0].status = "withdrawn";
  assert.equal(isAdmitted(product, company, REVIEW_DATE), false);
  company.assessments[0].status = "current";
  company.assessments.push({ ...company.assessments[0], sourceId: "new-negative-rating", grade: "C", periodEnd: "2026-08-31" });
  assert.equal(isAdmitted(product, company, REVIEW_DATE), false);
});
test("admission and empty-result explanations use Beijing calendar days at review boundaries", (t) => {
  const { product, company } = assessedProduct();
  const catalog = { ...data, products: [product], companies: [company] };
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-09-11T15:59:59.999Z") });
  for (const [instant, expected] of [
    ["2026-09-11T15:59:59.999Z", 0],
    ["2026-09-11T16:00:00.000Z", 1],
    ["2026-09-12T00:00:00.000Z", 1],
    ["2027-06-02T15:59:59.999Z", 1],
    ["2027-06-02T16:00:00.000Z", 0],
  ]) {
    t.mock.timers.setTime(Date.parse(instant));
    assert.equal(isAdmitted(product, company), Boolean(expected), instant);
    assert.equal(selectAdmittedProducts(catalog).length, expected, instant);
    const availability = getCatalogAvailability(catalog, defaults);
    assert.equal(availability.admittedCount, expected, instant);
    assert.equal(availability.gaps.productionLabor, 1 - expected, instant);
  }
});
test("incomplete or inconsistent assessment dates cannot admit a product", () => {
  for (const change of [{ reviewDueAt: undefined }, { reviewDueAt: "2027-99-99" }, { reviewedAt: "unknown" }, { periodStart: "2026-01-01" }]) {
    const { product, company } = assessedProduct();
    Object.assign(company.assessments[0], change);
    assert.equal(isAdmitted(product, company, REVIEW_DATE), false);
  }
});
test("a revised rating for the same year supersedes the earlier A rating", () => {
  const { product, company } = assessedProduct();
  company.assessments.push({ ...company.assessments[0], sourceId: "revised-rating", grade: "B" });
  assert.equal(isAdmitted(product, company, REVIEW_DATE), false);
});
test("upstream verification remains an optional filter and is not inferred from policies", () => {
  const { product, company } = assessedProduct();
  const catalog = { ...data, companies: [company], products: [product] };
  assert.equal(selectAdmittedProducts(catalog, REVIEW_DATE).length, 1);
  assert.equal(selectProducts(catalog, { ...defaults, supply: true }).length, 0);
  company.supply = company.supply.map((s) => ({ ...s, status: "verified", sourceIds: ["stage-record"] }));
  assert.equal(selectProducts(catalog, { ...defaults, supply: true }).length, 1);
  company.supply[2].status = "policy";
  assert.equal(hasVerifiedChain(company), false);
  assert.equal(isAdmitted(product, company, REVIEW_DATE), true);
});
test("the catalog separates admitted and unverified products without fixing a total count", () => {
  const { product, company } = assessedProduct();
  const pending = structuredClone(product);
  pending.id = "pending-product";
  pending.admission.chinaProduction.status = "pending";
  const catalog = { ...data, products: [product, pending], companies: [company] };
  assert.deepEqual(selectAdmittedProducts(catalog, REVIEW_DATE).map((p) => p.id), [product.id]);
  assert.equal(selectProducts(catalog, { ...defaults, saved: true }, [product.id, pending.id]).length, 2);
});
test("empty-result explanations retain the requested product scope while counting overlapping evidence gaps", () => {
  const { product, company } = assessedProduct();
  company.origin = "china";
  product.name = "示例笔记本电脑";
  product.category = "electronics";
  product.needs = ["笔记本电脑"];
  product.admission.chinaProduction.status = "pending";
  product.admission.productionLabor.status = "pending";
  const unrelated = { ...product, id: "unrelated", category: "food" };
  const otherNeed = { ...product, id: "other-need", needs: ["显示器"] };
  const noKeyword = { ...product, id: "no-keyword", name: "显示器" };
  const internationalCompany = { ...company, id: "international-company", origin: "international" };
  const otherOrigin = { ...product, id: "other-origin", companyId: internationalCompany.id };
  const catalog = { ...data, products: [product, unrelated, otherNeed, noKeyword, otherOrigin], companies: [company, internationalCompany] };
  const filters = { ...defaults, category: "electronics", need: "笔记本电脑", query: "示例笔记本", origin: "china", evidence: "hiring", supply: true, saved: true, sort: "name" };
  const before = structuredClone(filters);
  const result = getCatalogAvailability(catalog, filters, REVIEW_DATE);
  assert.equal(result.admittedCount, 0);
  assert.equal(result.pendingCount, 1);
  assert.deepEqual(result.gaps, { chinaSale: 0, chinaProduction: 1, productionLabor: 1 });
  assert.equal(selectProducts(catalog, result.filters).length, 1);
  assert.equal(result.filters.query, filters.query);
  assert.equal(result.filters.need, filters.need);
  assert.equal(result.filters.origin, filters.origin);
  assert.equal(result.filters.sort, filters.sort);
  assert.deepEqual(filters, before);
});
test("an optional full-chain filter can hide an admitted product without creating an admission gap", () => {
  const { product, company } = assessedProduct();
  const catalog = { ...data, companies: [company], products: [product] };
  const filters = { ...defaults, category: product.category, supply: true, evidence: "hiring" };
  assert.equal(selectProducts(catalog, filters).length, 0);
  const result = getCatalogAvailability(catalog, filters, REVIEW_DATE);
  assert.equal(result.admittedCount, 1);
  assert.equal(result.pendingCount, 0);
  assert.deepEqual(result.gaps, { chinaSale: 0, chinaProduction: 0, productionLabor: 0 });
  assert.equal(selectProducts(catalog, result.filters).length, 1);
});
test("empty-result explanations count an overdue rating as a labor gap and distinguish absent research", () => {
  const { product, company } = assessedProduct();
  const catalog = { ...data, companies: [company], products: [product] };
  const result = getCatalogAvailability(catalog, defaults, "2027-06-03");
  assert.equal(result.admittedCount, 0);
  assert.equal(result.pendingCount, 1);
  assert.deepEqual(result.gaps, { chinaSale: 0, chinaProduction: 0, productionLabor: 1 });
  const absent = getCatalogAvailability(catalog, { ...defaults, query: "no-such-product-948" }, REVIEW_DATE);
  assert.equal(absent.admittedCount, 0);
  assert.equal(absent.pendingCount, 0);
  assert.deepEqual(absent.gaps, { chinaSale: 0, chinaProduction: 0, productionLabor: 0 });
});
test("government assessment filters survive shared URLs", () => {
  const filters = { ...defaults, evidence: "assessment" };
  assert.deepEqual(readFilters(writeFilters(filters), data.categories.map((c) => c.id)), filters);
  assert(selectProducts(data, filters).some((p) => p.companyId === "guangzhonghuang"));
});
test("search matches an underlying company across its consumer brands", () => {
  const found = selectProducts(data, { ...defaults, query: "安克" });
  assert(found.some((p) => p.brand === "eufy"));
  assert(found.some((p) => p.brand === "soundcore"));
  assert(found.every((p) => p.companyId === "anker"));
});
test("search ignores case, surrounding whitespace and full-width Latin letters", () => {
  const ids = (q) =>
    selectProducts(data, { ...defaults, query: q }).map((x) => x.id);
  assert.deepEqual(ids(" ＡＮＫＥＲ "), ids("anker"));
  assert.equal(ids("does-not-exist-93299").length, 0);
});
test("category, status, saved and search constraints are combined", () => {
  const p = data.products.find((p) => p.id === "eufy-x10-pro-omni");
  const f = {
    ...defaults,
    category: "appliances",
    evidence: "disclosure",
    query: "eufy",
    saved: true,
  };
  assert.deepEqual(
    selectProducts(data, f, [p.id]).map((p) => p.id),
    [p.id],
  );
  assert.equal(selectProducts(data, f, []).length, 0);
});
test("shareable filters round-trip with Chinese text and punctuation", () => {
  const filters = {
    category: "games",
    need: "手机游戏",
    origin: "china",
    query: "心动 & 小镇",
    evidence: "disclosure",
    supply: true,
    saved: true,
    sort: "name",
  };
  assert.deepEqual(
    readFilters(
      writeFilters(filters),
      data.categories.map((c) => c.id),
    ),
    filters,
  );
});
test("untrusted URL values fall back safely without throwing", () => {
  const f = readFilters(
    "category=bogus&origin=bogus&evidence=certified&sort=hack&q=%ZZ&product=x",
    data.categories.map((c) => c.id),
  );
  assert.equal(f.category, "all");
  assert.equal(f.origin, "all");
  assert.equal(f.evidence, "all");
  assert.equal(f.sort, "evidence");
  assert.equal(readFilters("q=" + "x".repeat(1000), []).query.length, 200);
});
test("Chinese brand filter combines with other constraints and survives shared URLs", () => {
  const filters = { ...defaults, origin: "china", category: "electronics" };
  const found = selectProducts(data, filters);
  assert(found.some((p) => p.companyId === "anker"));
  assert(!found.some((p) => p.companyId === "apple"));
  assert(found.every((p) => data.companies.find((c) => c.id === p.companyId).origin === "china"));
  assert.deepEqual(readFilters(writeFilters(filters), data.categories.map((c) => c.id)), filters);
  assert.equal(selectProducts(data, { ...filters, supply: true }).length, 0);
});
test("known hiring caveats and supplier differences remain present", () => {
  const shokken = data.companies.find((c) => c.id === "shokken");
  assert(shokken.caveats.some((t) => t.includes("繁忙期")));
  assert.equal(
    data.companies.find((c) => c.id === "ergonor").level,
    "research",
  );
  assert.equal(data.companies.find((c) => c.id === "lego").level, "research");
  assert(
    data.companies
      .find((c) => c.id === "anker")
      .caveats.some((t) => t.includes("2024")),
  );
});

test("coverage matches actual uses, not company names or product flavours", () => {
  const flour = selectProducts(data, {...defaults, category: "food", need: "面粉"});
  assert(flour.some((p) => p.id === "kailan-bread-flour-1kg"));
  assert(!flour.some((p) => p.id === "kailan-yam-noodles"));
  assert(!selectProducts(data, {...defaults, category: "food", need: "红豆"}).some((p) => p.companyId === "meiji-ice"));
  const filter = {...defaults, category: "food", need: "面粉"};
  assert.deepEqual(readFilters(writeFilters(filter), data.categories.map((c) => c.id)), filter);
});
