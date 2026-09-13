import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  ArrowRight,
  Layers3,
  Check,
  BookOpen,
  Bookmark,
  X,
  Clock3,
  CalendarDays,
  Building2,
  Link2,
  ChevronDown,
  CircleHelp,
  FileText,
  GitBranch,
  RotateCcw,
  Download,
  Plus,
  Menu,
  CheckCheck,
} from "lucide-react";
import rawData from "../public/data/catalog.json";
import {
  defaults,
  selectProducts,
  readFilters,
  writeFilters,
  hasVerifiedChain,
  isAdmitted,
  selectAdmittedProducts,
  getLaborAssessment,
  getCatalogAvailability,
  laborEvidenceLabel,
  laborTopics,
} from "./catalog.mjs";
import type { Catalog, Product, Source, Filters, EvidenceLevel } from "./types";

const data = rawData as Catalog;
const BASE = import.meta.env.BASE_URL;
const REPO = `https://github.com/${import.meta.env.VITE_REPOSITORY || "hancao97/fair-labor-goods"}`;
const levels: Record<EvidenceLevel, { name: string; detail: string }> = {
  assessment: {
    name: "政府评价",
    detail: "政府劳动守法评级或符合收录范围的综合劳动评价；逐项对应生产企业、期间和实际评价范围。",
  },
  audit: {
    name: "独立劳动审核",
    detail: "已核对独立机构的原始审核或认证记录、适用工厂与期间；企业自述通过审核不属于此类。",
  },
  disclosure: {
    name: "制度披露",
    detail: "企业年报或制度提供工时、休息安排依据；实际履行待核。",
  },
  hiring: {
    name: "岗位线索",
    detail: "招聘资料披露工作安排，证据只适用于所述岗位和年份。",
  },
  research: {
    name: "待补证",
    detail: "尚缺对应生产企业的劳动合规依据；资料不足不表示违法。",
  },
};
const companyMap = new Map(data.companies.map((c) => [c.id, c]));
const sourceMap = new Map(data.sources.map((s) => [s.id, s]));
const categoryMap = new Map(data.categories.map((c) => [c.id, c]));
const external = { target: "_blank", rel: "noopener noreferrer" } as const;
const categoryIds = data.categories.map((c) => c.id);
const admittedProducts = selectAdmittedProducts(data);
const researchProducts = data.products.filter((p) => !isAdmitted(p, companyMap.get(p.companyId)!));
const admissionLabels = { chinaSale: "大陆购买 / 使用", chinaProduction: "境内生产 / 服务", productionLabor: "生产岗位劳动证据" } as const;
const quickSearches = [
  { label: "大米", category: "food", query: "大米", featured: true },
  { label: "面粉", category: "food", query: "面粉", featured: true },
  { label: "杂粮", category: "food", query: "杂粮" },
  { label: "食用油", category: "food", query: "食用油", featured: true },
  { label: "酱醋调味", category: "food", query: "调味" },
  { label: "牛奶", category: "drinks", query: "牛奶", featured: true },
  { label: "酒水", category: "drinks", query: "酒" },
  { label: "水果生鲜", category: "fresh", query: "", featured: true },
  { label: "汽车", category: "cars", query: "", featured: true },
  { label: "住房", category: "housing", query: "", featured: true },
  { label: "衣服", category: "clothing", query: "", featured: true },
  { label: "鞋履", category: "clothing", query: "鞋" },
  { label: "内衣", category: "clothing", query: "内衣" },
  { label: "笔", category: "stationery", query: "笔", featured: true },
  { label: "纸本", category: "stationery", query: "纸", featured: true },
  { label: "橡皮", category: "stationery", query: "橡皮" },
  { label: "文件收纳", category: "stationery", query: "文件" },
  { label: "自行车", category: "transport", query: "自行车" },
  { label: "电动车", category: "transport", query: "电动车" },
  { label: "住宿", category: "transport", query: "住宿" },
  { label: "餐饮", category: "dining", query: "", featured: true },
  { label: "正餐", category: "dining", query: "正餐" },
  { label: "咖啡", category: "dining", query: "咖啡" },
  { label: "手机", category: "electronics", query: "手机", featured: true },
  { label: "笔记本", category: "electronics", query: "笔记本", featured: true },
  { label: "平板", category: "electronics", query: "平板" },
  { label: "充电器", category: "electronics", query: "充电器" },
  { label: "耳机", category: "electronics", query: "耳机" },
  { label: "书桌照明", category: "home", query: "台灯" },
  { label: "座椅", category: "home", query: "椅" },
  { label: "收纳", category: "home", query: "收纳" },
  { label: "厨房餐具", category: "kitchen", query: "", featured: true },
  { label: "冰箱", category: "appliances", query: "冰箱", featured: true },
  { label: "洗衣机", category: "appliances", query: "洗衣机", featured: true },
  { label: "洗碗机", category: "appliances", query: "洗碗机" },
  { label: "扫拖机器人", category: "appliances", query: "扫拖" },
  { label: "清洁洗护", category: "daily", query: "洗护", featured: true },
  { label: "床品", category: "home", query: "床品" },
  { label: "阅读", category: "culture", query: "阅读", featured: true },
  { label: "玩具积木", category: "culture", query: "积木" },
  { label: "游戏手柄", category: "culture", query: "手柄" },
  { label: "电子游戏", category: "games", query: "", featured: true },
];
function loadSaved(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem("gongdao:saved:v1") || "[]");
    return Array.isArray(ids)
      ? ids.filter((id) => data.products.some((p) => p.id === id))
      : [];
  } catch {
    return [];
  }
}
function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  return ["research", "coverage", "companies", "method", "sources"].includes(hash) ? hash : "catalog";
}
function issueUrl(product?: Product) {
  return `${REPO}/issues/new?template=evidence.yml${product ? `&title=${encodeURIComponent("[资料补充] " + product.brand + " " + product.name)}` : ""}`;
}
function Badge({ level }: { level: EvidenceLevel }) {
  return (
    <span className={`badge ${level}`} title={levels[level].detail}>
      <span />
      {levels[level].name}
    </span>
  );
}
function ProductImage({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!product.image || failed)
    return (
      <div className="type-art">
        <span>{product.brand}</span>
        <b>
          {failed || product.id !== "shokken-seasoning" ? (
            product.name
          ) : (
            <>
              日常滋味
              <br />
              从一味开始
            </>
          )}
        </b>
        <small>
          {failed
            ? "图片暂不可用"
            : product.id === "shokken-seasoning"
              ? "复合调味料 · 产品系列"
              : "商品资料"}
        </small>
      </div>
    );
  return (
    <img
      src={BASE + product.image}
      alt={`${product.brand} ${product.name}商品资料图`}
      loading={large ? "eager" : "lazy"}
      decoding="async"
      className={product.imageMode}
      width="640"
      height="480"
      onError={() => setFailed(true)}
    />
  );
}
function SourceCard({ source }: { source: Source }) {
  return (
    <article className="source-card">
      <div className="source-icon">
        <FileText size={19} />
      </div>
      <div>
        <div className="source-meta">
          <span>{source.type}</span>
          <span>{source.publishedAt || "发布日期未标明"}</span>
        </div>
        <a href={source.url} {...external} className="source-title">
          {source.title}
          <ArrowUpRight size={15} />
        </a>
        <p>{source.summary}</p>
        <p className="source-limits">{source.limitation}</p>
        <small>
          {source.publisher} · {source.locator}
        </small>
        <small>资料查阅 {source.checkedAt}</small>
      </div>
    </article>
  );
}

function ProductDetail({
  product,
  onClose,
  saved,
  onSave,
}: {
  product: Product;
  onClose: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  const c = companyMap.get(product.companyId)!;
  const laborAssessment = getLaborAssessment(product, c);
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState("evidence");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const el = dialog.current!;
    const prev = document.activeElement as HTMLElement | null;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      el.close();
      prev?.focus();
    };
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}${location.pathname}?product=${encodeURIComponent(product.id)}#/${isAdmitted(product, c) ? "catalog" : "research"}`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const sources = [
    ...new Set([
      ...c.sourceIds,
      ...(c.assessments || []).flatMap((a) => [a.sourceId, ...(a.basisSourceIds || []), ...(a.verificationSourceId ? [a.verificationSourceId] : [])]),
      ...product.relationshipSourceIds,
      ...Object.values(product.admission).flatMap((check) => check.sourceIds),
    ]),
  ]
    .map((id) => sourceMap.get(id)!)
    .filter(Boolean);
  return (
    <dialog
      ref={dialog}
      className="product-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="product-title"
    >
      <div className="dialog-inner">
        <div className="dialog-top">
          <span>{isAdmitted(product, c) ? "商品与劳动档案" : "待核查资料 · 尚未正式收录"}</span>
          <button
            autoFocus
            className="icon-button"
            aria-label="关闭商品详情"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="product-overview">
          <div className="detail-image">
            <ProductImage product={product} large />
          </div>
          <div className="detail-intro">
            <span className="product-brand">{product.brand}</span>
            <h2 id="product-title">{product.name}</h2>
            <p>{product.description}</p>
            <Badge level={c.level} />
            <div className="detail-facts">
              <span>
                <Clock3 size={16} />
                {c.hoursLabel}
              </span>
              <span>
                <CalendarDays size={16} />
                {c.restLabel}
              </span>
            </div>
            <div className="detail-actions">
              <a className="button primary" href={product.url} {...external}>
                {isAdmitted(product, c) ? "查看渠道详情" : "查看商品资料"}
                <ArrowUpRight size={16} />
              </a>
              <button
                className={`icon-button save ${saved ? "is-saved" : ""}`}
                onClick={onSave}
                aria-label={saved ? "取消收藏" : "收藏商品"}
                aria-pressed={saved}
              >
                <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
            <small className="market-note">{product.market}</small>
            <small className="market-note">{c.originNote}</small>
          </div>
        </div>
        <div className="detail-tabs" aria-label="商品档案">
          {[
            ["evidence", "劳动依据"],
            ["supply", "供应链追踪"],
            ["sources", "原始来源"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "sources" && <span>{sources.length}</span>}
            </button>
          ))}
        </div>
        <div className="detail-content">
          <section className="admission-checks" aria-label="商品收录条件检查">
            {Object.entries(admissionLabels).map(([key, label]) => {
              const check = product.admission[key as keyof typeof product.admission];
              return <div key={key} className={key === "productionLabor" && !laborAssessment ? "pending" : check.status}>
                <strong>{label}<small>{key === "productionLabor" ? (laborAssessment ? laborEvidenceLabel(laborAssessment) : "待补充或复核") : check.status === "supported" ? "有对应来源" : "待补充依据"}</small></strong>
                <p>{check.detail}</p>
                {check.sourceIds.map((id) => <a key={id} href={sourceMap.get(id)!.url} {...external}>{sourceMap.get(id)!.title}<ArrowUpRight size={12} /></a>)}
              </div>;
            })}
          </section>
          {tab === "evidence" && (
            <>
              <div className="evidence-summary">
                <span className="eyebrow">目前能确认的资料</span>
                <h3>{c.finding}</h3>
                <p>{levels[c.level].detail}</p>
              </div>
              <dl className="evidence-dl">
                <div>
                  <dt>资料主体</dt>
                  <dd>{c.legalName}</dd>
                </div>
                <div>
                  <dt>适用范围</dt>
                  <dd>{c.scope}</dd>
                </div>
                <div>
                  <dt>商品关联</dt>
                  <dd>{product.relationship}</dd>
                </div>
                <div>
                  <dt>劳动判断依据</dt>
                  <dd>{laborAssessment ? `${laborAssessment.subject}：${laborAssessment.result}（${laborAssessment.period}）。本站于 ${laborAssessment.reviewedAt} 查阅，计划在 ${laborAssessment.reviewDueAt} 前复核。${laborAssessment.validUntil ? `所引用证书有效截止日：${laborAssessment.validUntil}。` : ""}` : "尚缺可支持本商品收录的劳动依据；政府评级、综合劳动评价及独立审核均可接受核对，详见上方检查与原始来源。"}</dd>
                </div>
                {laborAssessment && <div>
                  <dt>证据范围与局限</dt>
                  <dd>{laborAssessment.issuer && `核验机构：${laborAssessment.issuer}。`}{laborAssessment.scope && `${laborAssessment.scope}。`}{laborAssessment.facility && `适用工厂：${laborAssessment.facility}。`}{laborAssessment.limitation} 该依据不保证未来所有用工情况。</dd>
                </div>}
                {laborAssessment?.coverage && <div>
                  <dt>劳动权益核对范围</dt>
                  <dd>{laborAssessment.coverage.map(topic => laborTopics[topic]).join("、")}</dd>
                </div>}
              </dl>
              <h3 className="minor-title">仍然需要看清的部分</h3>
              <ul className="caveats">
                {c.caveats.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <button className="text-button" onClick={() => setTab("sources")}>
                逐条查看资料原文
                <ArrowRight size={15} />
              </button>
            </>
          )}
          {tab === "supply" && (
            <>
              <div className="section-heading">
                <h3>从品牌，到更远的上游</h3>
                <span className="subtle-tag">
                  {hasVerifiedChain(c)
                    ? "全链证据齐备"
                    : "全链实际履约尚未验证"}
                </span>
              </div>
              <p className="help-text">
                这里继续记录原料、外包与物流等环节。生产企业的适用劳动证据用于商品收录判断，全供应链追踪作为补充信息。
              </p>
              <div className="supply-timeline">
                {c.supply.map((s, i) => (
                  <article key={s.stage}>
                    <div className={`stage-dot ${s.status}`}>{i + 1}</div>
                    <div>
                      <div className="stage-title">
                        <h4>{s.stage}</h4>
                        <span>
                          {s.status === "policy"
                            ? "有公开制度 / 管理资料"
                            : s.status === "verified"
                              ? "实际执行已核"
                              : "证据待补"}
                        </span>
                      </div>
                      <p>{s.detail}</p>
                      {s.sourceIds.map((id) => (
                        <a key={id} href={sourceMap.get(id)?.url} {...external}>
                          {sourceMap.get(id)?.title}
                          <ArrowUpRight size={13} />
                        </a>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <div className="next-evidence">
                <GitBranch size={19} />
                <div>
                  <strong>下一步要补什么</strong>
                  <p>{c.nextCheck}</p>
                </div>
              </div>
            </>
          )}
          {tab === "sources" && (
            <>
              <p className="help-text">
                逐条区分政府评价、独立审核、企业自述、招聘承诺和产品资料。查阅日期不等于证据覆盖期。
              </p>
              <div className="source-list">
                {sources.map((s) => (
                  <SourceCard key={s.id} source={s} />
                ))}
              </div>
              <p className="image-credit">
                图片来源：
                {product.imageSource ? (
                  <a href={product.imageSource} {...external}>
                    查看原图
                  </a>
                ) : (
                  "未使用商品照片"
                )}
                。
                {product.imageRights}
                本站整理的资料不代表品牌背书。
              </p>
            </>
          )}
        </div>
        <div className="dialog-footer">
          <a href={issueUrl(product)} {...external}>
            <Plus size={15} />
            补充或纠正这条资料
          </a>
          <button onClick={copy} className="text-button">
            {copied ? <CheckCheck size={16} /> : <Link2 size={16} />}{" "}
            {copied ? "链接已复制" : "复制商品链接"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
function ProductCard({
  product,
  saved,
  onSave,
  onOpen,
}: {
  product: Product;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  const c = companyMap.get(product.companyId)!;
  return (
    <article className="product-card">
      <div className="card-visual">
        <button
          className="image-link"
          onClick={onOpen}
          aria-label={`查看 ${product.name} 的劳动依据`}
        >
          <ProductImage product={product} />
        </button>
        <span className="card-category">
          {categoryMap.get(product.category)?.name}
        </span>
        <button
          className={`card-save ${saved ? "is-saved" : ""}`}
          aria-pressed={saved}
          onClick={onSave}
          aria-label={`${saved ? "取消收藏" : "收藏"} ${product.name}`}
        >
          <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-brand-row">
          <span className="product-brand">{product.brand}</span>
          {c.origin === "china" && <span className="origin-tag">中国品牌</span>}
        </div>
        <button className="product-name" onClick={onOpen}>
          {product.name}
        </button>
        <p className="product-desc">{product.description}</p>
        <p className="admission-card-note">{isAdmitted(product, c) ? `${laborEvidenceLabel(getLaborAssessment(product, c)!)} · ${getLaborAssessment(product, c)!.period}` : "待核查 · 不作合规推荐"}</p>
        <div className="card-evidence">
          <Badge level={c.level} />
          <span>
            {c.level === "assessment" || c.level === "audit" ? "证据主体与期间见档案" : c.level === "research"
              ? "尚不足以判断"
              : c.level === "hiring"
                ? "仅适用所述岗位"
                : "实际履行待核"}
          </span>
        </div>
        <div className="card-bottom">
          <span>
            <Clock3 size={13} />
            {c.cardNote}
          </span>
          <button onClick={onOpen} aria-label={`打开 ${product.name} 详情`}>
            <ArrowUpRight size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}
function Method() {
  return (
    <div className="document-page">
      <div className="page-heading">
        <span className="eyebrow">关于我们的选择</span>
        <h1>
          一份好物目录，
          <br />
          从尊重劳动开始。
        </h1>
        <p>
          正式目录收录大陆可购买或使用、境内生产或提供、生产岗位劳动条件有证据支持的商品与服务。
          <br className="desktop" />
          任何一项缺失，都留在独立的待核查区。
        </p>
      </div>
      <section className="method-principles">
        {[
          ["大陆可以买到或使用", "商品需要可核验的中国大陆销售渠道与对应型号；免费公开服务需要明确的境内开放及使用方式。海外网页、中文介绍或品牌在华经营不能单独证明可购买或使用。"],
          ["中国境内生产或服务", "实体商品需有对应型号或规格的境内制造商依据。餐饮、住宿对应境内具体门店；数字商品对应境内开发及服务团队。批次差异注明适用范围。"],
          ["依据劳动法判断", "关注合同、工资、社保、工时休息与劳动保护。可核对政府守法评级、综合劳动评价和独立劳动审核；企业制度与招聘承诺单独不足以判断实际合规。"],
          [
            "依法安排工时与休息",
            "标准工时为每日 8 小时、每周 40 小时；加班须遵守法定条件、时长和报酬要求。法律不一概要求固定双休，经批准的特殊工时另行核对。",
          ],
          [
            "对应企业、工厂与期间",
            "把商品制造商与证据中的法人逐一对应，工厂限定的审核还需对应同一工厂。保留覆盖期、查阅与复核日期，总部、关联公司或其他代工厂的资料不互相套用。",
          ],
          [
            "继续追踪供应链",
            "把制造、原料、外包与物流分别记录。上游资料可以继续补充，不以取得全供应链所有人的考勤记录作为商品入选前提。",
          ],
        ].map(([title, body], i) => (
          <article key={title}>
            <span>0{i + 1}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="method-section">
        <h2>不同资料，说明不同的事实。</h2>
        <div className="level-explainer">
          {Object.entries(levels).map(([k, v]) => (
            <article key={k}>
              <Badge level={k as EvidenceLevel} />
              <h3>
                {k === "assessment" ? "查得到政府评价" : k === "audit" ? "核对了独立审核" : k === "disclosure"
                  ? "查得到制度"
                  : k === "hiring"
                    ? "找到了岗位承诺"
                    : "还缺关键依据"}
              </h3>
              <p>{v.detail}</p>
            </article>
          ))}
        </div>
        <p className="notice-line">
          <CircleHelp size={17} />
          当前正式目录为 {admittedProducts.length} 件；待核查区的制度和招聘资料不构成合规保证。
        </p>
      </section>
      <section className="method-section text-section">
        <h2>关注的是在哪里劳动、劳动权益是否受到保障。</h2>
        <p>中国境内生产不能推断每位工人的国籍。本站以境内生产和服务岗位为核查范围，不收集工人的身份证件或个人国籍信息，也不作全体工人均为中国国籍的保证。</p>
      </section>
      <section className="method-section text-section">
        <h2>符合劳动法，如何转化为收录标准？</h2>
        <p>
          政府劳动保障守法 A 级是可用依据之一。符合范围要求的政府综合劳动评价、独立机构劳动审核，也可支持收录。逐项展示出具机构、原始依据、适用企业或工厂、覆盖期间与局限。
        </p>
        <p>
          综合评价和独立审核需核对合同、工资与加班报酬、社保、工时、休息和劳动保护的覆盖范围，以及适用的中国劳动要求。只涉及欠薪一项的证明、证书宣传图或“通过审核”的企业自述，仍不足以支持整体劳动判断。未解决的问题、撤回和到期记录须继续复核。
        </p>
        <p>
          《劳动法》第 38 条规定每周至少休息一日，第 41、44 条规定加班条件、时长与报酬；特殊工时依审批和适用规则核对。本站不再另加“必须双休、含加班也不能超过 40 小时”的门槛。
        </p>
        <a
          href={sourceMap.get("law-hours")!.url}
          {...external}
          className="text-button"
        >
          阅读《国务院关于职工工作时间的规定》
          <ArrowUpRight size={15} />
        </a>
        <a href={sourceMap.get("law-labor")!.url} {...external} className="text-button">阅读《劳动法》<ArrowUpRight size={15} /></a>
        <a href={sourceMap.get("law-labor-rating")!.url} {...external} className="text-button">阅读劳动保障守法评价办法<ArrowUpRight size={15} /></a>
        <a href="https://www.mohrss.gov.cn/SYrlzyhshbzb/ztzl/xsdhxldgx/zcwj/202301/t20230103_492690.html?bsh_bid=5907708910" {...external} className="text-button">查看和谐劳动关系评价框架<ArrowUpRight size={15} /></a>
        <a href="https://sa-intl.org/resources/sa8000-standard/" {...external} className="text-button">查看独立劳动审核框架示例<ArrowUpRight size={15} /></a>
      </section>
      <section className="method-section text-section">
        <h2>什么样的证据值得保留？</h2>
        <p>
          从具体生产企业查起，同时查看政府评价、独立审核及公开劳动资料。政府最终评价保留所列法人和时期；独立审核核对原始报告或可查验的发证记录、核验机构与适用工厂。上市公司制度和招聘用于补充，不能自动升级为实际合规结论。
        </p>
        <p>
          每条记录包含资料主体、发布日期、查阅日期、适用范围和例外。所有收录依据设置本站复核日期；证书还核对其有效截止日。到期未复核的商品回到待核查区，本站期限不替代发证机构的有效期。出现更新评价或相反证据，应重新判断并及时撤回不再适用的依据。
        </p>
      </section>
      <section className="contribution-panel">
        <BookOpen size={28} />
        <div>
          <h2>让每一个好选择，都多一份依据。</h2>
          <p>
            你可以补充公开劳动制度、具体岗位资料或商品供应商信息。请隐去个人联系方式、身份证号等与核验无关的信息。
          </p>
          <a className="button primary" href={issueUrl()} {...external}>
            提交资料线索
            <ArrowUpRight size={16} />
          </a>
          <a
            className="text-button"
            href={`${REPO}/blob/main/CONTRIBUTING.md`}
            {...external}
          >
            共建指南
            <ArrowRight size={15} />
          </a>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const [filters, setFilters] = useState<Filters>(() =>
    readFilters(location.search, categoryIds),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [saved, setSaved] = useState(loadSaved);
  const [storageError, setStorageError] = useState(false);
  const [selected, setSelected] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("product"),
  );
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [sourceType, setSourceType] = useState("all");
  const selectedProduct = data.products.find((p) => p.id === selected);
  const researching = route === "research";
  const routeProducts = filters.saved ? data.products : researching ? researchProducts : admittedProducts;
  const products = useMemo(
    () => selectProducts({ ...data, products: routeProducts }, filters, saved),
    [filters, saved, routeProducts],
  );
  const availability = useMemo(() => getCatalogAvailability(data, filters), [filters]);
  const update = (part: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...((part.category !== undefined || part.query !== undefined) && part.need === undefined ? {need: ""} : {}), ...part }));
  const navigateWithFilters = (nextRoute: string, nextFilters: Filters) => {
    const query = writeFilters(nextFilters);
    history.pushState(null, "", `${location.pathname}${query ? "?" + query : ""}#/${nextRoute}`);
    setFilters(nextFilters);
    setSelected(null);
    setRoute(nextRoute);
    setMobileNav(false);
    window.scrollTo({top: 0, behavior: "instant"});
  };
  const save = (id: string) =>
    setSaved((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  useEffect(() => {
    try {
      localStorage.setItem("gongdao:saved:v1", JSON.stringify(saved));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [saved]);
  useEffect(() => {
    const onRoute = () => {
      setRoute(currentRoute());
      setMobileNav(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const onPop = () => {
      setFilters(readFilters(location.search, categoryIds));
      setSelected(new URLSearchParams(location.search).get("product"));
      onRoute();
    };
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onRoute);
      window.removeEventListener("popstate", onPop);
    };
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(writeFilters(filters));
    if (selected) p.set("product", selected);
    const q = p.toString();
    history.replaceState(
      null,
      "",
      location.pathname + (q ? "?" + q : "") + (location.hash || "#/catalog"),
    );
  }, [filters, selected]);
  useEffect(() => {
    const names: Record<string, string> = {
      catalog: "商品目录",
      research: "待核查资料",
      coverage: "消费清单",
      companies: "企业档案",
      method: "收录标准",
      sources: "资料库",
    };
    document.title = `${names[route]} · 工道好物`;
  }, [route]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setToast("当前筛选链接已复制");
    } catch {
      setToast("复制未成功，可复制浏览器地址栏链接");
    }
  };
  const visibleSources = data.sources.filter(
    (s) =>
      (sourceType === "all" || s.type === sourceType) &&
      `${s.title} ${s.publisher} ${s.summary}`
        .toLowerCase()
        .includes(sourceQuery.toLowerCase()),
  );
  const visibleCompanies = data.companies.filter((c) =>
    `${c.name} ${c.legalName} ${c.location}`
      .toLowerCase()
      .includes(companyQuery.toLowerCase()),
  );
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="site-header">
        <a className="brand" href="#/catalog" aria-label="工道好物首页">
          <img src={BASE + "favicon.svg"} alt="" />
          <span>
            工道好物<small>GONGDAO GOODS</small>
          </span>
        </a>
        <nav className={mobileNav ? "mobile-open" : ""} aria-label="主要导航">
          {[
            ["catalog", "商品目录"],
            ["research", "待核查"],
            ["coverage", "消费清单"],
            ["companies", "企业档案"],
            ["method", "收录标准"],
          ].map(([id, name]) => (
            <a
              key={id}
              className={route === id ? "active" : ""}
              href={`#/${id}`}
              aria-current={route === id ? "page" : undefined}
            >
              {name}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="header-saved"
            onClick={() => navigateWithFilters("catalog", {...defaults, saved: !filters.saved})}
            aria-label="查看收藏商品"
          >
            <Bookmark size={18} />
            <span>{saved.length}</span>
          </button>
          <a className="contribute" href={REPO} {...external}>
            开放共建
            <ArrowUpRight size={15} />
          </a>
          <button
            className="mobile-menu icon-button"
            aria-expanded={mobileNav}
            aria-label="切换导航菜单"
            onClick={() => setMobileNav((v) => !v)}
          >
            {mobileNav ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      <main id="main-content">
        {(route === "catalog" || researching) && (
          <>
            <section className="intro">
              <div>
                <div className="eyebrow">
                  <span className="rule" /> 每一次选择，都有分量
                </div>
                <h1>
                  {filters.saved ? "把关心的好物，" : researching ? "把每个日常所需，" : "支持境内劳动，"}
                  <br />
                  {filters.saved ? <>留在<span>我的收藏。</span></> : researching ? <>都<span>查得更清楚。</span></> : <>从<span>有据可查</span>开始。</>}
                </h1>
                <p>
                  {filters.saved ? "收藏同时保留正式收录商品和待核查资料，每件都标明当前状态。" : researching ? "这里是尚未通过收录检查的研究资料，不是合规推荐清单。" : "大陆买得到、中国境内生产、境内生产岗位劳动条件有据可查。"}
                  <br className="desktop" />
                  {filters.saved ? "收藏保存在当前浏览器，也可以继续按分类和关键词查找。" : researching ? "从一袋米、一支笔，到一部手机、一顿饭，逐项补齐证据。" : "三项必须同时满足；品牌国别不能替代产地和工人权益证据。"}
                </p>
                <a className="intro-link" href="#/method">
                  了解我们如何收录
                  <ArrowRight size={15} />
                </a>
              </div>
              <aside className="standard-card">
                <span className="eyebrow">支持守法用工的企业</span>
                <div className="standard-numbers">
                  <div>
                    <strong>
                      依法
                    </strong>
                    <span>合同、工资、社保与休息</span>
                  </div>
                  <i />
                  <div>
                    <strong>
                      有据
                    </strong>
                    <span>核对生产企业与劳动依据</span>
                  </div>
                </div>
                <a href="#/method">
                  查看完整收录依据
                  <ArrowRight size={16} />
                </a>
              </aside>
            </section>
            <div className="catalog-summary">
              <div>
                <span className="live-dot" />
                {filters.saved ? "我的收藏 · 每件商品分别标明收录状态" : researching ? "待核查资料，尚未正式收录" : "正式收录条件逐项核查"}
              </div>
              <span>
                <b>{admittedProducts.length}</b> 件正式收录
              </span>
              <span>
                <b>{researchProducts.length}</b> 件待核查资料
              </span>
              <span><b>{data.categories.length}</b> 类日常所需</span>
              <span className="summary-date">
                最近整理 {data.updatedAt.replaceAll("-", ".")}
                <a href="#/sources">
                  资料库
                  <ArrowUpRight size={13} />
                </a>
              </span>
            </div>
            <section className="catalog" id="catalog">
              <div className="section-top">
                <div>
                  <span className="eyebrow section-eyebrow">
                    THE EVERYDAY COLLECTION
                  </span>
                  <h2>{filters.saved ? "我的收藏" : researching ? "日常所需，逐项核查。" : "符合收录条件的商品"}</h2>
                </div>
                <a className="quiet text-button" href="#/method">
                  有依据的收录，可追溯的选择
                  <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="categories" aria-label="商品分类">
                {[{ id: "all", name: researching ? "全部资料" : "全部商品" }, ...data.categories].map(
                  (c) => (
                    <button
                      key={c.id}
                      className={filters.category === c.id ? "selected" : ""}
                      aria-pressed={filters.category === c.id}
                      onClick={() => update({ category: c.id, query: "" })}
                    >
                      {c.name}
                      <span>{routeProducts.filter((p) =>
                        (c.id === "all" || p.category === c.id) &&
                        (filters.origin === "all" || companyMap.get(p.companyId)?.origin === "china")
                      ).length}</span>
                    </button>
                  ),
                )}
              </div>
              <div className="catalog-toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    type="search"
                    maxLength={200}
                    placeholder="搜索商品、品牌或企业"
                    aria-label="搜索商品、品牌或企业"
                    value={filters.query}
                    onChange={(e) => update({ query: e.target.value })}
                  />
                  {filters.query && (
                    <button
                      className="clear-search"
                      aria-label="清空商品搜索"
                      onClick={() => update({ query: "" })}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <div className="toolbar-actions">
                  <button
                    className={`filter-button ${filters.saved ? "is-active" : ""}`}
                    aria-pressed={filters.saved}
                    aria-label="我的收藏"
                    onClick={() => update({ saved: !filters.saved })}
                  >
                    <Bookmark size={16} />
                    <span>我的收藏</span>
                    {saved.length > 0 && <small>{saved.length}</small>}
                  </button>
                  <button
                    className={`filter-button ${filterOpen ? "is-active" : ""}`}
                    onClick={() => setFilterOpen((o) => !o)}
                    aria-expanded={filterOpen}
                    aria-controls="filter-panel"
                  >
                    <SlidersHorizontal size={16} />
                    筛选依据
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
              <div className="origin-filters" aria-label="品牌背景筛选">
                <div>
                  <button aria-pressed={filters.origin === "all"} onClick={() => update({ origin: "all" })}>全部品牌</button>
                  <button aria-pressed={filters.origin === "china"} onClick={() => update({ origin: "china" })}>中国品牌</button>
                </div>
                <span>按品牌创立背景整理；具体产地见商品档案。</span>
              </div>
              {filters.need && <p className="need-selection">细分需求：<strong>{filters.need}</strong><button className="text-button" onClick={() => update({need: ""})}>取消需求筛选<X size={13} /></button></p>}
              <div className="quick-searches">
                <span>常用物品</span>
                <div
                  className="quick-search-list"
                  aria-label="常用商品快捷查找"
                >
                  {quickSearches
                    .filter((item) =>
                      filters.category === "all"
                        ? item.featured
                        : item.category === filters.category,
                    )
                    .map((item) => (
                      <button
                        key={item.label}
                        aria-label={`查找${item.label}`}
                        aria-pressed={
                          filters.category === item.category &&
                          filters.query === item.query
                        }
                        onClick={() =>
                          update({ category: item.category, query: item.query })
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                </div>
              </div>
              {filterOpen && (
                <div id="filter-panel" className="filter-panel">
                  <fieldset>
                    <legend>资料状态</legend>
                    <div className="radio-buttons">
                      {[
                        ["all", "全部状态"],
                        ...Object.entries(levels).map(([id, x]) => [
                          id,
                          x.name,
                        ]),
                      ].map(([id, name]) => (
                        <label key={id}>
                          <input
                            type="radio"
                            name="evidence"
                            value={id}
                            checked={filters.evidence === id}
                            onChange={() => update({ evidence: id })}
                          />
                          {name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="chain-filter">
                    <input
                      type="checkbox"
                      checked={filters.supply}
                      onChange={(e) => update({ supply: e.target.checked })}
                    />
                    <span>
                      仅看全供应链实际履约已核实
                      <small>
                        当前 {data.products.filter((p) => hasVerifiedChain(companyMap.get(p.companyId)!)).length} 件；这是额外筛选，商品收录不强制要求。
                      </small>
                    </span>
                  </label>
                </div>
              )}
              <div className="evidence-note">
                <BookOpen size={17} />
                <p>
                  {filters.saved ? "收藏不改变商品的收录状态。正式收录与待核查资料会分别标注。" : researching ? "本区商品仍有购买渠道、生产主体或劳动依据需要补充。资料不足不代表企业违法。" : "已对应大陆销售、境内生产企业及适用的劳动证据。依据类型、对象、期间和来源可在每件商品中查看。"}
                </p>
                <a href="#/method" aria-label="了解资料分级">
                  <CircleHelp size={17} />
                </a>
              </div>
              <div className="results-bar">
                <span aria-live="polite">
                  {filters.category === "all"
                    ? "全部分类"
                    : categoryMap.get(filters.category)?.name}{" "}
                  <b>{products.length}</b> 件
                  {filters.origin === "china" && " · 中国品牌"}
                  {filters.evidence !== "all" &&
                    ` · ${levels[filters.evidence as EvidenceLevel].name}`}
                  {filters.saved && " · 我的收藏"}
                  {filters.supply && " · 全链已核实"}
                </span>
                <div>
                  <button className="text-button share-filter" onClick={share}>
                    <Link2 size={14} />
                    分享筛选
                  </button>
                  <label className="sort-select">
                    <span className="sr-only">商品排序</span>
                    <select
                      value={filters.sort}
                      onChange={(e) => update({ sort: e.target.value })}
                    >
                      <option value="evidence">依据完整度优先</option>
                      <option value="name">按商品名称</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
              </div>
              {storageError && (
                <p className="storage-notice">
                  当前浏览器无法保存收藏；本次访问中仍可使用。
                </p>
              )}
              {products.length ? (
                <div className="product-grid">
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      saved={saved.includes(p.id)}
                      onSave={() => save(p.id)}
                      onOpen={() => setSelected(p.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Search size={30} />
                  {!researching && !filters.saved ? (
                    availability.admittedCount > 0 ? (
                      <>
                        <h3>附加筛选隐藏了已收录的商品</h3>
                        <p>
                          按当前分类、细分需求、品牌与关键词，已有 {availability.admittedCount} 件正式收录商品。
                          {filters.supply ? "全供应链核实是额外筛选，不是商品收录条件。" : "当前资料类型筛选与这些商品不匹配。"}
                        </p>
                        <button className="button primary" onClick={() => setFilters(availability.filters)}>
                          <RotateCcw size={15} />清除附加筛选，查看 {availability.admittedCount} 件
                        </button>
                      </>
                    ) : availability.pendingCount > 0 ? (
                      <>
                        <h3>这一范围尚无正式收录商品</h3>
                        <p>已整理 {availability.pendingCount} 件同类待核查资料，下面列出仍缺的依据。资料不足不代表企业违法。</p>
                        <dl className="admission-gaps">
                          {(Object.keys(availability.gaps) as (keyof typeof availability.gaps)[])
                            .filter((key) => availability.gaps[key] > 0)
                            .map((key) => (
                              <div key={key}>
                                <dt>{admissionLabels[key]}</dt>
                                <dd><b>{availability.gaps[key]}</b> 件待补或复核</dd>
                              </div>
                            ))}
                        </dl>
                        <p className="gap-count-note">同一件商品可能缺少多项依据；不会因单休或存在加班就自动排除。</p>
                        <button className="button primary" onClick={() => navigateWithFilters("research", availability.filters)}>
                          查看这 {availability.pendingCount} 件待核查资料<ArrowRight size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <h3>这一范围还没有商品资料</h3>
                        <p>当前分类与关键词下尚未找到具体商品。可以调整筛选，或到消费清单查看已调查的品类和缺口。</p>
                        <div className="empty-actions">
                          <button className="button primary" onClick={() => setFilters({ ...defaults })}>
                            <RotateCcw size={15} />重置筛选，查看全部
                          </button>
                          <a className="text-button" href="#/coverage">查看消费清单<ArrowRight size={15} /></a>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <h3>{filters.saved ? "没有符合当前筛选的收藏" : "没有找到符合当前筛选的资料"}</h3>
                      <p>{filters.saved ? "收藏感兴趣的商品，稍后再回来逐项查阅。" : "试试品牌、商品名称，或减少筛选条件。"}</p>
                      <button className="button primary" onClick={() => setFilters({ ...defaults })}>
                        <RotateCcw size={15} />重置筛选，查看全部
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="catalog-end">
                <span className="end-line" />
                <span>每一件好物，都值得多问一句。</span>
                <span className="end-line" />
              </div>
              <div className="more-evidence">
                <div>
                  <span className="eyebrow">THE NEXT GOOD CHOICE</span>
                  <h2>你知道下一件好物吗？</h2>
                  <p>一份招聘简章、一项公开制度，都可能让这份目录更完整。</p>
                </div>
                <a className="button light" href={issueUrl()} {...external}>
                  补充一条线索
                  <Plus size={17} />
                </a>
              </div>
            </section>
            <section className="method-preview">
              <div>
                <Layers3 size={21} />
                <h2>认真看见，商品背后的劳动。</h2>
              </div>
              <p>
                <Check size={16} /> 核对工时与休息安排
              </p>
              <p>
                <Check size={16} /> 标明岗位与主体
              </p>
              <a href="#/method">
                我们的收录标准
                <ArrowRight size={15} />
              </a>
            </section>
          </>
        )}
        {route === "method" && <Method />}
        {route === "coverage" && (
          <div className="document-page coverage-page">
            <div className="page-heading"><span className="eyebrow">日常消费调查清单</span><h1>把日常所需，逐项查全。</h1><p>每个细分品类都保留位置。数字是已整理的候选资料数；只有通过销售、产地和生产岗位劳动检查，才能正式收录。</p></div>
            <div className="coverage-grid">{data.coverage.map((group) => <section key={group.category}>
              <h2>{categoryMap.get(group.category)?.name}</h2>
              <div className="coverage-needs">{group.needs.map((need) => {
                const found = selectProducts(data, { ...defaults, category: group.category, need: need.label });
                const admitted = found.filter((p) => isAdmitted(p, companyMap.get(p.companyId)!)).length;
                return <button key={need.label} onClick={() => navigateWithFilters(admitted ? "catalog" : "research", {...defaults, category:group.category, need:need.label})}><span>{need.label}</span><small>{found.length ? `${found.length} 份资料 · ${admitted} 件收录` : "尚无具体商品"}</small></button>;
              })}</div>
              <p>{group.note}</p>
              {group.sourceIds.map((id) => <a key={id} href={sourceMap.get(id)!.url} {...external}>{sourceMap.get(id)!.title}<ArrowUpRight size={12} /></a>)}
            </section>)}</div>
          </div>
        )}
        {route === "companies" && (
          <div className="document-page">
            <div className="page-heading">
              <span className="eyebrow">BEHIND THE GOODS</span>
              <h1>认识商品背后的企业。</h1>
              <p>
                从品牌名称走向具体主体，把工作安排、适用岗位与供应链放在一起看。
              </p>
            </div>
            <div className="stats-row">
              <div>
                <b>{data.companies.length}</b>
                <span>企业档案</span>
              </div>
              <div>
                <b>
                  {
                    data.companies.filter((c) => c.level === "disclosure")
                      .length
                  }
                </b>
                <span>有制度披露</span>
              </div>
              <div>
                <b>
                  {data.companies.filter((c) => c.level === "hiring").length}
                </b>
                <span>有岗位线索</span>
              </div>
              <div>
                <b>{data.companies.filter((c) => c.level === "assessment" || c.level === "audit").length}</b>
                <span>有劳动评价或审核</span>
              </div>
            </div>
            <label className="search full-search">
              <Search size={18} />
              <input
                type="search"
                placeholder="搜索企业、品牌或地区"
                aria-label="搜索企业档案"
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
              />
            </label>
            <div className="company-list">
              {visibleCompanies.map((c) => (
                <article key={c.id} className="company-card">
                  <div className="company-heading">
                    <div className="company-monogram">{c.name.slice(0, 1)}</div>
                    <div>
                      <h2>{c.name}</h2>
                      <span>
                        <Building2 size={13} />
                        {c.location}
                      </span>
                    </div>
                    <Badge level={c.level} />
                  </div>
                  <p>{c.finding}</p>
                  {c.assessments?.map((a) => <div className="official-assessment" key={a.sourceId + a.subject}>
                    <strong>{a.result}<span>{a.period}</span></strong>
                    <p>评价对象：{a.subject}。{a.limitation}</p>
                    <a href={sourceMap.get(a.sourceId)!.url} {...external}>查看原始依据<ArrowUpRight size={13} /></a>
                  </div>)}
                  <dl>
                    <div>
                      <dt>工作安排</dt>
                      <dd>
                        {c.hoursLabel} · {c.restLabel}
                      </dd>
                    </div>
                    <div>
                      <dt>适用范围</dt>
                      <dd>{c.scope}</dd>
                    </div>
                    <div>
                      <dt>供应链</dt>
                      <dd>实际履约待核实</dd>
                    </div>
                  </dl>
                  <div className="company-products">
                    {data.products
                      .filter((p) => p.companyId === c.id)
                      .map((p) => (
                        <button key={p.id} onClick={() => setSelected(p.id)}>
                          {p.name}
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                  </div>
                </article>
              ))}
            </div>
            {!visibleCompanies.length && (
              <div className="empty-state">
                <Building2 size={28} />
                <h3>没有找到这家企业</h3>
                <button
                  className="text-button"
                  onClick={() => setCompanyQuery("")}
                >
                  清空搜索
                </button>
              </div>
            )}
          </div>
        )}
        {route === "sources" && (
          <div className="document-page">
            <div className="page-heading">
              <span className="eyebrow">OPEN EVIDENCE LIBRARY</span>
              <h1>让依据，始终可以被查阅。</h1>
              <p>保留原始来源、适用范围和查阅日期，让每一次补充都有迹可循。</p>
              <a
                className="text-button"
                href={BASE + "data/catalog.json"}
                download="gongdao-catalog.json"
              >
                <Download size={16} />
                下载完整资料 JSON
              </a>
            </div>
            <div className="catalog-toolbar">
              <label className="search">
                <Search size={18} />
                <input
                  type="search"
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  placeholder="搜索资料标题、发布者或内容"
                  aria-label="搜索资料库"
                />
              </label>
              <label className="sort-select source-select">
                <span className="sr-only">来源类型</span>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                >
                  <option value="all">全部来源类型</option>
                  {[...new Set(data.sources.map((s) => s.type))].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
            <p className="help-text" aria-live="polite">
              {visibleSources.length} 条来源 · 最近查阅 {data.updatedAt} ·
              商品关联与劳动条件分别核验
            </p>
            <div className="source-list library">
              {visibleSources.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
            </div>
            {!visibleSources.length && (
              <div className="empty-state">
                <FileText size={28} />
                <h3>没有匹配的资料</h3>
                <button
                  className="text-button"
                  onClick={() => {
                    setSourceQuery("");
                    setSourceType("all");
                  }}
                >
                  清空搜索和筛选
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      <footer>
        <div className="footer-brand">
          <img src={BASE + "favicon.svg"} alt="" />
          <span>
            工道好物<small>好工作，值得被选择。</small>
          </span>
        </div>
        <p>
          以公开证据，连接日常选择。
          <br />
          独立资料项目 · 图片版权归原权利人所有
        </p>
        <div className="footer-links">
          <a href="#/sources">资料库</a>
          <a href="#/method">收录标准</a>
          <a href={REPO} {...external}>
            GitHub
            <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {selectedProduct && (
        <ProductDetail
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelected(null)}
          saved={saved.includes(selectedProduct.id)}
          onSave={() => save(selectedProduct.id)}
        />
      )}
    </>
  );
}
