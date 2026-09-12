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
test("government provenance and the recorded review date are checked for alternative reviews", () => {
  const { assessment, sources } = fixture("government-labor-review");
  sources[1].url = "https://example.gov.cn.unrelated.example/result";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
  sources[1].url = "https://example.gov.cn/result";
  sources[0].publishedAt = "2026-10-01";
  assert.throws(() => validateLaborEvidenceSources(assessment, sources));
});
