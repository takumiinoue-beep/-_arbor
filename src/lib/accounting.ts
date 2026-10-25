import type { Expense, IncentiveTier, Member, MemberKind, PlPlanEntry, PlSection, VendorInvoice } from "@/types/database";

// 事業年度の開始月（PDFのPLは9月始まり〜8月）
export const FISCAL_START_MONTH = 9;
// 売上のうち手元に残す割合（PDFの「残す金額（売上の5%）」）
export const SALES_RETAIN_RATE = 0.05;

export const SGA_ACCOUNTS = [
  "役員報酬",
  "給料手当",
  "法定福利費",
  "外注費",
  "荷造運賃",
  "広告宣伝費",
  "交際費",
  "求人広告掲載費用",
  "旅費交通費",
  "通信費",
  "システム利用料",
  "消耗品費",
  "水道光熱費",
  "地代家賃",
  "リース料",
  "租税公課",
  "雑費",
  "減価償却費",
  "長期前払費用償却",
] as const;

// 経費・取引先請求で選べる、原価（外注費）側に計上する科目
export const COGS_OUTSOURCE_ACCOUNT = "原価（外注費）";
// インセンティブは外注費にまとめて計上する（メンバーの設定からの自動計算も、経費・請求で選んだ場合も）
export const INCENTIVE_ACCOUNT = "インセンティブ";
export const ACCOUNT_OPTIONS: string[] = [...SGA_ACCOUNTS, COGS_OUTSOURCE_ACCOUNT, INCENTIVE_ACCOUNT];

// 原価（外注費）側の行名にする科目か
const isOutsourceAccount = (account: string) => account === COGS_OUTSOURCE_ACCOUNT || account === INCENTIVE_ACCOUNT;

export const MEMBER_KINDS: { value: MemberKind; label: string }[] = [
  { value: "labor_existing", label: "直雇用（既存）" },
  { value: "labor_new", label: "直雇用（新人）" },
  { value: "outsource", label: "業務委託" },
  { value: "executive", label: "役員報酬" },
  { value: "salary", label: "給料手当" },
];

export const SECTION_LABELS: Record<PlSection, string> = {
  sales: "売上",
  labor: "原価（労務費）",
  outsource: "原価（外注費）",
  sga: "販売管理費",
};

// ---------- 事業年度 ----------

export function currentFiscalYear(todayISO: string): number {
  const year = Number(todayISO.slice(0, 4));
  const month = Number(todayISO.slice(5, 7));
  return month >= FISCAL_START_MONTH ? year : year - 1;
}

// 事業年度（開始年）の12か月分 "YYYY-MM"
export function fiscalMonths(fy: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m0 = FISCAL_START_MONTH - 1 + i;
    const year = fy + Math.floor(m0 / 12);
    const month = (m0 % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}

export function fiscalRange(fy: number): { from: string; toExclusive: string } {
  const months = fiscalMonths(fy);
  const last = months[11];
  const lastYear = Number(last.slice(0, 4));
  const lastMonth = Number(last.slice(5, 7));
  const nextYear = lastMonth === 12 ? lastYear + 1 : lastYear;
  const nextMonth = lastMonth === 12 ? 1 : lastMonth + 1;
  return {
    from: `${months[0]}-01`,
    toExclusive: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

export function fiscalYearLabel(fy: number): string {
  const months = fiscalMonths(fy);
  return `${months[0].slice(0, 4)}年${Number(months[0].slice(5, 7))}月〜${months[11].slice(0, 4)}年${Number(months[11].slice(5, 7))}月`;
}

export function monthLabel(key: string): string {
  return `${Number(key.slice(5, 7))}月`;
}

// ---------- PLの入力（計画・実績で共通の形） ----------

// 金額の内訳（カーソルを当てたときに表示する）
export type PlDetail = { text: string; amount: number };
export type PlLine = { label: string; values: number[]; details?: PlDetail[][] };
export type PlInput = Record<PlSection, PlLine[]>;

const zeros = () => Array<number>(12).fill(0);

export function emptyPlInput(): PlInput {
  return { sales: [], labor: [], outsource: [], sga: [] };
}

class LineBook {
  private map = new Map<string, number[]>();
  private details = new Map<string, PlDetail[][]>();

  add(label: string, monthIndex: number, amount: number, detail?: string) {
    if (monthIndex < 0 || !amount) return;
    const values = this.map.get(label) ?? zeros();
    values[monthIndex] += amount;
    this.map.set(label, values);

    if (detail) {
      const d = this.details.get(label) ?? Array.from({ length: 12 }, () => [] as PlDetail[]);
      d[monthIndex].push({ text: detail, amount });
      this.details.set(label, d);
    }
  }

  lines(): PlLine[] {
    return Array.from(this.map, ([label, values]) => ({ label, values, details: this.details.get(label) }));
  }
}

const SECTIONS: PlSection[] = ["sales", "labor", "outsource", "sga"];

export function planKey(section: PlSection, label: string): string {
  return `${section}\u0000${label}`;
}

// 計画の売上（手入力のみ）を「OP×月」にする。計画の行名がOP名と一致するものが対象。
// 計画上のインセンティブを自動計算するために使う。
export function planSalesByStaff(
  entries: PlPlanEntry[],
  months: string[],
  staffIdByName: Map<string, string>
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (e.section !== "sales" || Number(e.amount) === 0) continue;
    const staffId = staffIdByName.get(e.line_label);
    const month = e.plan_month.slice(0, 7);
    if (!staffId || !months.includes(month)) continue;
    const byMonth = result.get(staffId) ?? new Map<string, number>();
    byMonth.set(month, (byMonth.get(month) ?? 0) + Number(e.amount));
    result.set(staffId, byMonth);
  }
  return result;
}

// 計画の自動値：メンバー人件費・経費・取引先請求の登録内容から作る（売上は含めない）
export function buildAutoPlan(args: Parameters<typeof buildActualInput>[0]): PlInput {
  const input = buildActualInput(args);
  return { ...input, sales: [] };
}

// 計画 ＝ 自動値（登録内容）に、計画入力で手入力した金額（0以外）を上書きしたもの。
// autoMap は行ごとの自動値（計画入力画面で「自動」表示・上書き判定に使う）。
export function resolvePlan(
  entries: PlPlanEntry[],
  months: string[],
  auto: PlInput,
  manualText = "計画入力で手入力した金額"
): { input: PlInput; autoMap: Map<string, number[]> } {
  type Override = { section: PlSection; label: string; values: (number | null)[]; order: number };
  const overrides = new Map<string, Override>();

  for (const e of entries) {
    const idx = months.indexOf(e.plan_month.slice(0, 7));
    if (idx < 0) continue;
    const key = planKey(e.section, e.line_label);
    let o = overrides.get(key);
    if (!o) {
      o = { section: e.section, label: e.line_label, values: Array<number | null>(12).fill(null), order: e.sort_order };
      overrides.set(key, o);
    }
    const amount = Number(e.amount);
    if (amount !== 0) o.values[idx] = amount;
    o.order = Math.min(o.order, e.sort_order);
  }

  const autoMap = new Map<string, number[]>();
  const input = emptyPlInput();

  for (const section of SECTIONS) {
    for (const l of auto[section]) autoMap.set(planKey(section, l.label), l.values);

    const labels = [...overrides.values()]
      .filter((o) => o.section === section)
      .sort((a, b) => a.order - b.order)
      .map((o) => o.label);
    for (const l of auto[section]) if (!labels.includes(l.label)) labels.push(l.label);

    for (const label of labels) {
      const key = planKey(section, label);
      const o = overrides.get(key);
      const a = autoMap.get(key);
      const autoDetails = auto[section].find((l) => l.label === label)?.details;
      input[section].push({
        label,
        values: Array.from({ length: 12 }, (_, i) => o?.values[i] ?? a?.[i] ?? 0),
        details: Array.from({ length: 12 }, (_, i) => {
          const manual = o?.values[i];
          if (manual != null) return [{ text: manualText, amount: manual }];
          return autoDetails?.[i] ?? [];
        }),
      });
    }
  }

  return { input, autoMap };
}

// その経費が指定月に計上されるか（単月／期間指定／継続）
export function isExpenseActive(
  e: Pick<Expense, "expense_month" | "end_month" | "ongoing">,
  month: string
): boolean {
  const start = e.expense_month.slice(0, 7);
  if (month < start) return false;
  if (e.ongoing) return true;
  return month <= (e.end_month ? e.end_month.slice(0, 7) : start);
}

export function expensePeriodLabel(e: Pick<Expense, "expense_month" | "end_month" | "ongoing">): string {
  const start = e.expense_month.slice(0, 7);
  if (e.ongoing) return `${start} 〜 継続`;
  if (e.end_month && e.end_month.slice(0, 7) !== start) return `${start} 〜 ${e.end_month.slice(0, 7)}`;
  return start;
}

// 事業年度[from, toExclusive)に1か月でも重なる経費を取得するための、PostgREST用のOR条件
export function expenseOverlapFilter(from: string): string {
  return `ongoing.eq.true,end_month.gte.${from},expense_month.gte.${from}`;
}

// 月の売上が達した最も高い段階の金額（どの段階にも届かなければ0）
export function incentiveFor(tiers: IncentiveTier[], sales: number): number {
  let result = 0;
  let reached = -1;
  for (const t of tiers) {
    if (sales >= Number(t.threshold) && Number(t.threshold) > reached) {
      reached = Number(t.threshold);
      result = Number(t.amount);
    }
  }
  return result;
}

// 実績（結果）：売上・メンバー人件費・経費・取引先請求から組み立てる
export function buildActualInput(args: {
  months: string[];
  members: Member[];
  expenses: Expense[];
  vendorInvoices: (VendorInvoice & { client?: { name: string } | null })[];
  salesByStaff: Map<string, Map<string, number>>; // staffId -> month -> 売上
  staffNames: Map<string, string>;
}): PlInput {
  const { months, members, expenses, vendorInvoices, salesByStaff, staffNames } = args;
  const monthIndex = (key: string) => months.indexOf(key);

  const sales = new LineBook();
  const labor = new LineBook();
  const outsource = new LineBook();
  const sga = new LineBook();

  // 売上：OPごと
  for (const [staffId, byMonth] of salesByStaff) {
    const name = staffNames.get(staffId) ?? "不明";
    for (const [month, amount] of byMonth) sales.add(name, monthIndex(month), amount);
  }

  // メンバー人件費・法定福利費・インセンティブ
  for (const member of members) {
    const startKey = member.start_month.slice(0, 7);
    const endKey = member.end_month ? member.end_month.slice(0, 7) : null;

    months.forEach((month, idx) => {
      if (month < startKey || (endKey && month > endKey)) return;

      const cost = Number(member.monthly_cost);
      const costText = `${member.name}（${memberKindLabel(member.kind)}・月額）`;
      switch (member.kind) {
        case "labor_existing":
          labor.add("直雇用（既存）", idx, cost, costText);
          break;
        case "labor_new":
          labor.add("直雇用（新人）", idx, cost, costText);
          break;
        case "outsource":
          outsource.add(member.name, idx, cost, costText);
          break;
        case "executive":
          sga.add("役員報酬", idx, cost, costText);
          break;
        case "salary":
          sga.add("給料手当", idx, cost, costText);
          break;
      }
      sga.add("法定福利費", idx, Number(member.monthly_social_insurance), `${member.name}（月額）`);

      if (member.profile_id && member.incentive_tiers?.length) {
        const memberSales = salesByStaff.get(member.profile_id)?.get(month) ?? 0;
        outsource.add(
          INCENTIVE_ACCOUNT,
          idx,
          incentiveFor(member.incentive_tiers, memberSales),
          `${member.name}（売上${formatShortYen(memberSales)}の段階）`
        );
      }
    });
  }

  // 経費（期間指定・継続の経費は、該当する各月に同額を計上）
  for (const e of expenses) {
    months.forEach((month, idx) => {
      if (!isExpenseActive(e, month)) return;
      const text = `経費：${e.description || "（内容なし）"}${
        e.ongoing || (e.end_month && e.end_month.slice(0, 7) !== e.expense_month.slice(0, 7))
          ? `（${expensePeriodLabel(e)}）`
          : ""
      }`;
      if (isOutsourceAccount(e.account)) {
        outsource.add(e.account === INCENTIVE_ACCOUNT ? INCENTIVE_ACCOUNT : "外注（経費）", idx, Number(e.amount), text);
      } else {
        sga.add(e.account, idx, Number(e.amount), text);
      }
    });
  }

  // 取引先からの請求（税抜で計上）
  for (const v of vendorInvoices) {
    const idx = monthIndex(v.invoice_date.slice(0, 7));
    const vendor = v.vendor_name || v.client?.name || "取引先";
    const text = `取引先請求：${vendor}${v.description ? `／${v.description}` : ""}（${v.invoice_date}）`;
    if (isOutsourceAccount(v.account)) {
      const label = v.account === INCENTIVE_ACCOUNT ? INCENTIVE_ACCOUNT : v.vendor_name || v.client?.name || "外注（取引先請求）";
      outsource.add(label, idx, Number(v.subtotal), text);
    } else {
      sga.add(v.account, idx, Number(v.subtotal), text);
    }
  }

  const sortByLabel = (lines: PlLine[]) => lines.sort((a, b) => a.label.localeCompare(b.label, "ja"));
  return {
    sales: sortByLabel(sales.lines()),
    labor: labor.lines(),
    outsource: sortByLabel(outsource.lines()),
    sga: sga.lines(),
  };
}

// ---------- 合計・利益の計算 ----------

export type PlTotals = {
  sales: number[];
  labor: number[];
  outsource: number[];
  cogs: number[];
  grossProfit: number[];
  sga: number[];
  operatingProfit: number[];
  retained: number[];
  cashFlow: number[];
  burn: number[];
};

const sumLines = (lines: PlLine[]): number[] =>
  lines.reduce((acc, l) => acc.map((v, i) => v + l.values[i]), zeros());

export function computeTotals(input: PlInput): PlTotals {
  const sales = sumLines(input.sales);
  const labor = sumLines(input.labor);
  const outsource = sumLines(input.outsource);
  const sga = sumLines(input.sga);
  const cogs = labor.map((v, i) => v + outsource[i]);
  const grossProfit = sales.map((v, i) => v - cogs[i]);
  const operatingProfit = grossProfit.map((v, i) => v - sga[i]);
  const retained = sales.map((v) => Math.round(v * SALES_RETAIN_RATE));
  const cashFlow = operatingProfit.map((v, i) => v - retained[i]);
  const burn = cogs.map((v, i) => v + sga[i]);
  return { sales, labor, outsource, cogs, grossProfit, sga, operatingProfit, retained, cashFlow, burn };
}

// ---------- 表示用の行 ----------

export type PlRowKind = "line" | "subtotal" | "total" | "highlight" | "percent" | "memo";

export type PlRow = {
  key: string;
  kind: PlRowKind;
  section?: PlSection;
  groupTitle?: string;
  label: string;
  plan: (number | null)[];
  actual: (number | null)[];
  planTotal: number | null;
  actualTotal: number | null;
  planDetails?: PlDetail[][];
  actualDetails?: PlDetail[][];
};

const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
const ratio = (num: number, den: number) => (den === 0 ? null : num / den);

function valuesFor(lines: PlLine[], label: string): number[] {
  return lines.find((l) => l.label === label)?.values ?? zeros();
}

function detailsFor(lines: PlLine[], label: string): PlDetail[][] | undefined {
  return lines.find((l) => l.label === label)?.details;
}

export function buildPlRows(plan: PlInput, actual: PlInput, showZero: boolean): PlRow[] {
  const pt = computeTotals(plan);
  const at = computeTotals(actual);
  const rows: PlRow[] = [];

  const lineRows = (section: PlSection, fixedOrder?: readonly string[]) => {
    const labels: string[] = [...(fixedOrder ?? [])];
    for (const l of [...plan[section], ...actual[section]]) {
      if (!labels.includes(l.label)) labels.push(l.label);
    }
    labels.forEach((label, i) => {
      const p = valuesFor(plan[section], label);
      const a = valuesFor(actual[section], label);
      if (!showZero && total(p) === 0 && total(a) === 0) return;
      rows.push({
        key: `${section}:${label}`,
        kind: "line",
        section,
        groupTitle: i === 0 ? SECTION_LABELS[section] : undefined,
        label,
        plan: p,
        actual: a,
        planTotal: total(p),
        actualTotal: total(a),
        planDetails: detailsFor(plan[section], label),
        actualDetails: detailsFor(actual[section], label),
      });
    });
  };

  const summary = (key: string, kind: PlRowKind, label: string, p: number[], a: number[]) => {
    rows.push({ key, kind, label, plan: p, actual: a, planTotal: total(p), actualTotal: total(a) });
  };
  const percent = (key: string, label: string, pn: number[], pd: number[], an: number[], ad: number[]) => {
    rows.push({
      key,
      kind: "percent",
      label,
      plan: pn.map((v, i) => ratio(v, pd[i])),
      actual: an.map((v, i) => ratio(v, ad[i])),
      planTotal: ratio(total(pn), total(pd)),
      actualTotal: ratio(total(an), total(ad)),
    });
  };

  lineRows("sales");
  summary("sales-total", "total", "合計（売上）", pt.sales, at.sales);
  lineRows("labor");
  summary("labor-sub", "subtotal", "小計（労務費）", pt.labor, at.labor);
  lineRows("outsource");
  summary("outsource-sub", "subtotal", "小計（外注費）", pt.outsource, at.outsource);
  summary("cogs-total", "total", "合計（原価）", pt.cogs, at.cogs);
  summary("gross", "highlight", "粗利益", pt.grossProfit, at.grossProfit);
  percent("gross-rate", "粗利益率", pt.grossProfit, pt.sales, at.grossProfit, at.sales);
  lineRows("sga", SGA_ACCOUNTS);
  summary("sga-total", "total", "販管費 計", pt.sga, at.sga);
  summary("op", "highlight", "営業利益", pt.operatingProfit, at.operatingProfit);
  percent("op-rate", "営業利益率", pt.operatingProfit, pt.sales, at.operatingProfit, at.sales);
  summary("retained", "memo", `残す金額（売上の${SALES_RETAIN_RATE * 100}%）`, pt.retained, at.retained);
  summary("cf", "memo", "CF（営業利益－残す金額）", pt.cashFlow, at.cashFlow);
  summary("burn", "memo", "バーンレート（原価＋販管費）", pt.burn, at.burn);

  return rows;
}

// 80万円・5,000円のように短く表示する
export function formatShortYen(value: number): string {
  if (value >= 10000 && value % 10000 === 0) return `${value / 10000}万円`;
  return `${value.toLocaleString("ja-JP")}円`;
}

export function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

export function formatPercentValue(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(2)}%`;
}

export function memberKindLabel(kind: MemberKind): string {
  return MEMBER_KINDS.find((k) => k.value === kind)?.label ?? kind;
}
