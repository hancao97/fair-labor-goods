import assert from "node:assert/strict";

const governmentHost = (url) => new URL(url).hostname.endsWith(".gov.cn");

// Public institutions also publish on other domains. Keep a checked government
// reference to the publisher and exact hosts instead of trusting a site label.
export function validateGovernmentPublicationSource(source, sources, reviewedAt = source.checkedAt) {
  if (governmentHost(source.url) && !source.publisherVerificationSourceId) return;
  const id = source.publisherVerificationSourceId;
  assert(typeof id === "string" && id.trim() && id !== source.id,
    "An external government publication needs a separate publisher verification source");
  const verification = sources.find((record) => record.id === id);
  assert(verification, `Missing publisher verification source ${id}`);
  assert.equal(verification.type, "发布机构核验");
  assert(governmentHost(verification.url), "Publisher verification needs an official government reference");
  assert(Array.isArray(verification.verifiedPublicationHosts) &&
    verification.verifiedPublicationHosts.includes(new URL(source.url).hostname),
  "The government reference must identify this publication host");
  assert(verification.checkedAt && verification.checkedAt <= reviewedAt &&
    (!verification.publishedAt || verification.publishedAt <= reviewedAt),
  "Publisher verification cannot postdate the recorded review");
}

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
    validateGovernmentPublicationSource(source, sources, assessment.reviewedAt);
    return;
  }
  if (assessment.kind === "employer-labor-disclosure") {
    assert.equal(assessment.conclusion, "adverse", "Employer disclosures cannot certify labor compliance");
    assert.equal(source.type, "企业法定披露");
    assert(source.publishedAt, "An employer's reported issue needs a dated original disclosure");
    assert.equal(assessment.verificationSourceId, assessment.sourceId, "Use the employer's original disclosure, not an audit label");
    assessment.basisSourceIds.forEach(find);
    return;
  }
  const government = assessment.kind === "government-labor-review";
  const types = government ? ["政府评价", "政府劳动检查"] : ["独立劳动审计", "社会责任认证记录"];
  const verification = find(assessment.verificationSourceId);
  for (const record of [source, verification]) {
    assert(types.includes(record.type), "A policy, logo or recruiting claim is not a verified labor result");
    if (government) validateGovernmentPublicationSource(record, sources, assessment.reviewedAt);
  }
  assessment.basisSourceIds.forEach(find);
}
