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
} from "./catalog.mjs";
import type { Catalog, Product, Source, Filters, EvidenceLevel } from "./types";

const data = rawData as Catalog;
const BASE = import.meta.env.BASE_URL;
const REPO = `https://github.com/${import.meta.env.VITE_REPOSITORY || "hancao97/fair-labor-goods"}`;
const levels: Record<EvidenceLevel, { name: string; detail: string }> = {
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
    detail: "尚不足以判断是否达到 40 小时与每周两天休息。",
  },
};
const companyMap = new Map(data.companies.map((c) => [c.id, c]));
const sourceMap = new Map(data.sources.map((s) => [s.id, s]));
const categoryMap = new Map(data.categories.map((c) => [c.id, c]));
const external = { target: "_blank", rel: "noopener noreferrer" } as const;
const categoryIds = data.categories.map((c) => c.id);
const quickSearches = [
  { label: "手机", category: "electronics", query: "手机", featured: true },
  { label: "笔记本", category: "electronics", query: "笔记本", featured: true },
  { label: "平板", category: "electronics", query: "平板" },
  { label: "充电器", category: "electronics", query: "充电器" },
  { label: "耳机", category: "electronics", query: "耳机" },
  { label: "书桌照明", category: "home", query: "台灯" },
  { label: "座椅", category: "home", query: "椅" },
  { label: "收纳", category: "home", query: "收纳" },
  { label: "冰箱", category: "appliances", query: "冰箱", featured: true },
  { label: "洗衣机", category: "appliances", query: "洗衣机", featured: true },
  { label: "洗碗机", category: "appliances", query: "洗碗机" },
  { label: "扫拖机器人", category: "appliances", query: "扫拖" },
  { label: "清洁洗护", category: "daily", query: "洗护", featured: true },
  { label: "食品", category: "daily", query: "食品", featured: true },
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
  return ["companies", "method", "sources"].includes(hash) ? hash : "catalog";
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
      alt={`${product.brand} ${product.name}官方产品图`}
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
        `${location.origin}${location.pathname}?product=${encodeURIComponent(product.id)}#/catalog`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const sources = [
    ...new Set([...c.sourceIds, ...product.relationshipSourceIds]),
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
          <span>商品与劳动档案</span>
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
                查看官方商品资料
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
                  <dt>实际履行</dt>
                  <dd>未获得独立考勤及休息记录验证。</dd>
                </div>
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
                有准则、有评估，都是追踪的起点。具体产品仍需要对应到制造商、外包团队和实际劳动记录。
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
                逐条区分企业自述、招聘承诺和产品资料。查阅日期不等于信息生效日期。
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
                    官方产品图片
                  </a>
                ) : (
                  "未使用商品照片"
                )}
                。
                {product.imageRights &&
                  `图片版权归 ${product.imageRights} 所有。`}
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
        <span className="product-brand">{product.brand}</span>
        <button className="product-name" onClick={onOpen}>
          {product.name}
        </button>
        <p className="product-desc">{product.description}</p>
        <div className="card-evidence">
          <Badge level={c.level} />
          <span>
            {c.level === "research"
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
          我们寻找在中国开展业务、公开披露合理工作安排的企业及其商品。
          <br className="desktop" />
          也把未能确认的部分，留在你看得见的地方。
        </p>
      </div>
      <section className="method-principles">
        {[
          [
            "每周不超过 40 小时",
            "分别记录标准制度与包含加班的实际工作时间。只有上下班时刻、未明确午休的资料，不据此推算工时。",
          ],
          [
            "每周至少休息 2 天",
            "分清固定周末和轮休。年假、补休和节假日不用于填补日常每周双休；旺季与特殊岗位例外明确标注。",
          ],
          [
            "继续追踪供应链",
            "把研发、制造、外包、原料与物流分开核对。总部的双休不能直接证明代工厂、外包团队也双休。",
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
        <h2>三种资料状态，三种阅读方式。</h2>
        <div className="level-explainer">
          {Object.entries(levels).map(([k, v]) => (
            <article key={k}>
              <Badge level={k as EvidenceLevel} />
              <h3>
                {k === "disclosure"
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
          当前目录没有获得独立考勤验证的商品，也没有任何商品被认定为全供应链达标。
        </p>
      </section>
      <section className="method-section text-section">
        <h2>为什么不直接给企业贴“合规”标签？</h2>
        <p>
          劳动条件涉及工时以外的工资、社保、安全、平等与其他权益。40
          小时加双休是本项目的消费筛选起点，不能替代对全部劳动法律义务的认定。休息日安排也可能因企业情况有所不同。
        </p>
        <a
          href={sourceMap.get("law-hours")!.url}
          {...external}
          className="text-button"
        >
          阅读《国务院关于职工工作时间的规定》
          <ArrowUpRight size={15} />
        </a>
      </section>
      <section className="method-section text-section">
        <h2>什么样的证据值得保留？</h2>
        <p>
          优先保存企业原始制度、上市公司报告、企业发布的招聘资料和能明确主体的劳动记录。高校转载的企业招聘仍是企业承诺，不是学校审核结果。匿名评价只能作为继续调查的线索，不能单独用于肯定或否定一家企业。
        </p>
        <p>
          每条记录包含资料主体、发布日期、查阅日期、适用范围和例外。超过一年的明确工时披露会标记为历史资料；更新页面不自动更新旧承诺。争议或反证需保留来源、核对时间与主体，再修订结论。
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
  const products = useMemo(
    () => selectProducts(data, filters, saved),
    [filters, saved],
  );
  const update = (part: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...part }));
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
            onClick={() => {
              location.hash = "/catalog";
              update({ saved: !filters.saved });
            }}
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
        {route === "catalog" && (
          <>
            <section className="intro">
              <div>
                <div className="eyebrow">
                  <span className="rule" /> 每一次选择，都有分量
                </div>
                <h1>
                  好商品背后，
                  <br />
                  也该有<span>好工作。</span>
                </h1>
                <p>
                  从一件日用品，到一款游戏。让尊重劳动的企业，
                  <br className="desktop" />
                  成为你日常消费里的一个选择。
                </p>
                <a className="intro-link" href="#/method">
                  了解我们如何收录
                  <ArrowRight size={15} />
                </a>
              </div>
              <aside className="standard-card">
                <span className="eyebrow">我们的筛选起点</span>
                <div className="standard-numbers">
                  <div>
                    <strong>
                      40<small>小时</small>
                    </strong>
                    <span>每周标准工时上限</span>
                  </div>
                  <i />
                  <div>
                    <strong>
                      2<small>天</small>
                    </strong>
                    <span>每周休息时间下限</span>
                  </div>
                </div>
                <a href="#/method">
                  还有商品背后的供应链
                  <ArrowRight size={16} />
                </a>
              </aside>
            </section>
            <div className="catalog-summary">
              <div>
                <span className="live-dot" />
                公开资料持续整理中
              </div>
              <span>
                <b>{data.products.length}</b> 件商品与系列
              </span>
              <span>
                <b>{data.companies.length}</b> 份企业档案
              </span>
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
                  <h2>把好选择，带回生活。</h2>
                </div>
                <a className="quiet text-button" href="#/method">
                  有依据的收录，可追溯的选择
                  <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="categories" aria-label="商品分类">
                {[{ id: "all", name: "全部好物" }, ...data.categories].map(
                  (c) => (
                    <button
                      key={c.id}
                      className={filters.category === c.id ? "selected" : ""}
                      aria-pressed={filters.category === c.id}
                      onClick={() => update({ category: c.id, query: "" })}
                    >
                      {c.name}
                      {filters.category === c.id && (
                        <span>
                          {c.id === "all"
                            ? data.products.length
                            : data.products.filter((p) => p.category === c.id)
                                .length}
                        </span>
                      )}
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
                        当前 0 件；公开准则与企业自述不计为实际验证。
                      </small>
                    </span>
                  </label>
                </div>
              )}
              <div className="evidence-note">
                <BookOpen size={17} />
                <p>
                  从公开资料出发，分别标明<span>制度披露</span>、
                  <span>岗位线索</span>和<span>待补证</span>
                  。收录不等于实际合规认证。
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
                  <h3>
                    {filters.supply
                      ? "暂时还没有全供应链已核实的商品"
                      : "没有找到符合当前筛选的商品"}
                  </h3>
                  <p>
                    {filters.supply
                      ? "这意味着证据还不够。你仍可查看已公开的制度与岗位资料。"
                      : filters.saved
                        ? "收藏感兴趣的商品，稍后再回来逐项查阅。"
                        : "试试品牌、商品名称，或减少筛选条件。"}
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setFilters({ ...defaults })}
                  >
                    <RotateCcw size={15} />
                    重置筛选，查看全部
                  </button>
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
                <b>0</b>
                <span>全链实际履约已核实</span>
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
              产品官网仅用于核对商品关联
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
          独立资料项目 · 图片版权归各品牌所有
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
