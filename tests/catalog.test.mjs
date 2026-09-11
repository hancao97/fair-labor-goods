import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  defaults,
  hasVerifiedChain,
  selectProducts,
  readFilters,
  writeFilters,
} from "../src/catalog.mjs";
const data = JSON.parse(
  await readFile(new URL("../public/data/catalog.json", import.meta.url)),
);

test("supplier policies and self-reporting never qualify as actual verification", () => {
  assert.equal(selectProducts(data, { ...defaults, supply: true }).length, 0);
  for (const c of data.companies) assert.equal(hasVerifiedChain(c), false);
});
test("missing hours cannot qualify, even with affirmative verification flags", () => {
  const c = {
    ...data.companies[0],
    actualHoursVerified: true,
    actualRestVerified: true,
    hours: null,
  };
  c.supply = c.supply.map((s) => ({
    ...s,
    status: "verified",
    sourceIds: ["independent-record"],
  }));
  assert.equal(hasVerifiedChain(c), false);
});
test("a single unverified upstream stage prevents full-chain qualification", () => {
  const c = {
    ...data.companies[0],
    actualHoursVerified: true,
    actualRestVerified: true,
  };
  c.supply = c.supply.map((s) => ({
    ...s,
    status: "verified",
    sourceIds: ["independent-record"],
  }));
  c.supply[2].status = "unknown";
  assert.equal(hasVerifiedChain(c), false);
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
    "category=bogus&evidence=certified&sort=hack&q=%ZZ&product=x",
    data.categories.map((c) => c.id),
  );
  assert.equal(f.category, "all");
  assert.equal(f.evidence, "all");
  assert.equal(f.sort, "evidence");
  assert.equal(readFilters("q=" + "x".repeat(1000), []).query.length, 200);
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
