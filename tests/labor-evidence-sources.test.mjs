import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLaborEvidenceSources } from "../scripts/labor-evidence-sources.mjs";

function fixture(kind = "independent-labor-audit") {
  const type = kind === "government-labor-review" ? "政府劳动检查" : "独立劳动审计";
  const url = kind === "government-labor-review" ? "https://example.gov.cn/result" : "https://auditor.example/result";
  return {
    assessment: { kind, sourceId: "report", verificationSourceId: "issuer-record", basisSourceIds: ["criteria"], reviewedAt: "2026-09-12" },
    sources: [
      { id: "report", type, url, publishedAt: "2026-06-01" },
      { id: "issuer-record", type, url, publishedAt: null },
      { id: "criteria", type: "审查标准", url, publishedAt: "2025-01-01" },
    ],
  };
}
test("government reviews and independently verifiable audit records pass provenance checks", () => {
  for (const kind of ["government-labor-review", "independent-labor-audit"]) {
    const { assessment, sources } = fixture(kind);
    assert.doesNotThrow(() => validateLaborEvidenceSources(assessment, sources));
  }
});
test("a dated outcome must use the verified result's actual publication date", () => {
  for (const kind of ["government-labor-rating", "government-labor-review"]) {
    const { assessment, sources } = fixture("government-labor-review");
    assessment.kind = kind;
    if (kind === "government-labor-rating") sources[0].type = "政府评价";
    assessment.resultPublishedAt = "2026-06-01";
    assert.doesNotThrow(() => validateLaborEvidenceSources(assessment, sources));
    assessment.resultPublishedAt = "2026-06-02";
    assert.throws(() => validateLaborEvidenceSources(assessment, sources));
    sources[0].publishedAt = null;
    assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  }
});
test("an audit claim cannot use corporate disclosure or a missing issuer record as verification", () => {
  const { assessment, sources } = fixture();
  sources[1].type = "企业自述";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[1].type = "独立劳动审计";
  sources[0].type = "企业招聘资料";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[0].type = "独立劳动审计";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources.filter(s => s.id !== "issuer-record")));
});
test("certification issue dates are verified against the credential record separately from publication", () => {
  const { assessment, sources } = fixture();
  sources[0].publishedAt = null;
  sources[0].issuedAt = "2025-07-23";
  assessment.resultIssuedAt = "2025-07-23";
  assert.doesNotThrow(() => validateLaborEvidenceSources(assessment, sources));
  assessment.resultIssuedAt = "2025-07-24";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  assessment.resultIssuedAt = "2025-07-23";
  sources[0].issuedAt = undefined;
  sources[0].publishedAt = "2025-07-23";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[0].issuedAt = "2025-07-23";
  assessment.kind = "government-labor-review";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
});
test("a disclosed adverse issue uses the dated original employer filing without masquerading as an audit", () => {
  const { assessment, sources } = fixture();
  Object.assign(assessment, {
    kind: "employer-labor-disclosure", conclusion: "adverse", verificationSourceId: "report",
  });
  sources[0].type = "企业法定披露";
  assert.doesNotThrow(() => validateLaborEvidenceSources(assessment, sources));
  for (const change of [
    { conclusion: "supported" }, { conclusion: "unresolved" }, { verificationSourceId: "issuer-record" },
  ]) assert.throws(() => validateLaborEvidenceSources({ ...assessment, ...change }, sources));
  sources[0].type = "新闻报道";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[0].type = "企业法定披露";
  sources[0].publishedAt = null;
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
});
test("government provenance and the recorded review date are checked for alternative reviews", () => {
  const { assessment, sources } = fixture("government-labor-review");
  sources[1].url = "https://example.gov.cn.unrelated.example/result";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[1].url = "https://example.gov.cn/result";
  sources[0].publishedAt = "2026-10-01";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
});

function externalGovernmentFixture(kind) {
  const { assessment, sources } = fixture("government-labor-review");
  assessment.kind = kind;
  if (kind === "government-labor-rating") sources[0].type = "政府评价";
  for (const source of sources) {
    if (["report", "issuer-record"].includes(source.id)) {
      source.url = "https://files.public-platform.example/labor-result.pdf";
      source.publisherVerificationSourceId = "publisher-reference";
    }
  }
  sources.push({ id: "publisher-reference", type: "发布机构核验",
    url: "https://authority.gov.cn/platform-directory", publishedAt: "2026-01-01",
    checkedAt: "2026-09-12", verifiedPublicationHosts: ["files.public-platform.example"] });
  return { assessment, sources };
}

test("officially identified public platforms can host government ratings and reviews", () => {
  for (const kind of ["government-labor-rating", "government-labor-review"]) {
    const { assessment, sources } = externalGovernmentFixture(kind);
    assert.doesNotThrow(() => validateLaborEvidenceSources(assessment, sources));
    for (const url of [
      "https://files.public-platform.example.unrelated.example/result",
      "https://unverified.public-platform.example/result",
    ]) {
      sources[0].url = url;
      assert.throws(() => validateLaborEvidenceSources(assessment, sources));
    }
  }
});

test("a platform cannot verify itself or substitute a corporate claim for a government reference", () => {
  const { assessment, sources } = externalGovernmentFixture("government-labor-review");
  const reference = sources.at(-1);
  sources[0].publisherVerificationSourceId = "report";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[0].publisherVerificationSourceId = "missing";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[0].publisherVerificationSourceId = reference.id;
  reference.url = "https://employer.example/our-awards";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  reference.url = "https://authority.gov.cn/platform-directory";
  reference.type = "企业自述";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
});

test("publisher verification does not replace a labor result or allow future verification", () => {
  const { assessment, sources } = externalGovernmentFixture("government-labor-review");
  sources[0].type = "企业自述";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[0].type = "政府劳动检查";
  const reference = sources.at(-1);
  reference.checkedAt = "2026-09-13";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  reference.checkedAt = "2026-09-12";
  reference.publishedAt = "2026-10-01";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
});
