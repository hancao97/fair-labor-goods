import assert from "node:assert/strict";

// Validate the provenance of a recorded conclusion, in addition to the coverage
// and factory checks used by the catalog. A self-report is not an audit record.
export function validateLaborEvidenceSources(assessment, sources) {
  const find = (id) => {
    const source = sources.find((item) => item.id === id);
    assert(source, `Missing labor evidence source ${id}`);
    assert(!source.publishedAt || source.publishedAt <= assessment.reviewedAt, "Labor evidence cannot be reviewed before publication");
    return source;
  };
  const source = find(assessment.sourceId);
  if (assessment.resultPublishedAt !== undefined) {
    assert.equal(assessment.resultPublishedAt, source.publishedAt,
      "The dated labor result must match its original source's publication date");
  }
  if (assessment.kind === "government-labor-rating") {
    assert.equal(source.type, "政府评价");
    assert(source.publishedAt, "Government ratings need a publication date");
    assert(new URL(source.url).hostname.endsWith(".gov.cn"));
    return;
  }
  const government = assessment.kind === "government-labor-review";
  const types = government ? ["政府评价", "政府劳动检查"] : ["独立劳动审计", "社会责任认证记录"];
  const verification = find(assessment.verificationSourceId);
  for (const record of [source, verification]) {
    assert(types.includes(record.type), "A policy, logo or recruiting claim is not a verified labor result");
    if (government) assert(new URL(record.url).hostname.endsWith(".gov.cn"));
  }
  assessment.basisSourceIds.forEach(find);
}
