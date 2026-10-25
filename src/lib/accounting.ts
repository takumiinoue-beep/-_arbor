import type { Expense, Member, MemberKind, PlPlanEntry, PlSection, VendorInvoice } from "@/types/database";

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
  "インセンティブ",
] as const;

// 経費・取引先請求で選べる、原価（外注費）側に計上する科目
export const COGS_OUTSOURCE_ACCOUNT = "原価（外注費）";
export const ACCOUNT_OPTIONS: string[] = [...SGA_ACCOUNTS, COGS_OUTSOURCE_ACCOUNT];

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

export type PlLine = { label: string; values: number[] };
export type PlInput = Record<PlSection, PlLine[]>;

const zeros = () => Array<number>(12).fill(0);

export function emptyPlInput(): PlInput {
  return { sales: [], labor: [], outsource: [], sga: [] };
}

class LineBook {
  private map = new Map<string, number[]>();
  add(label: string, monthIndex: number, amount: number) {
    if (monthIndex < 0 || !amount) return;
    const values = this.map.get(label) ?? zeros();
    values[monthIndex] += amount;
    this.map.set(label, values);
  }
  lines(): PlLine[] {
    return Array.from(this.map, ([label, values]) => ({ label, values }));
  }
}

export function planEntriesToInput(entries: PlPlanEntry[], months: string[]): PlInput {
  const input = emptyPlInput();
  const orders = new Map<string, number>();
  const lineMap = new Map<string, PlLine>();

  for (const e of entries) {
    const idx = months.indexOf(e.plan_month.slice(0, 7));
    if (idx < 0) continue;
    const key = `${e.section}\u0000${e.line_label}`;
    let line = lineMap.get(key);
    if (!line) {
      line = { label: e.line_label, values: zeros() };
      lineMap.set(key, line);
      orders.set(key, e.sort_order);
      input[e.section].push(line);
    }
    line.values[idx] += Number(e.amount);
    if (e.sort_order < (orders.get(key) ?? 0)) orders.set(key, e.sort_order);
  }

  for (const section of Object.keys(input) as PlSection[]) {
    input[section].sort(
      (a, b) =>
        (orders.get(`${section}\u0000${a.label}`) ?? 0) - (orders.get(`${section}\u0000${b.label}`) ?? 0)
    );
  }
  return input;
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
      switch (member.kind) {
        case "labor_existing":
          labor.add("直雇用（既存）", idx, cost);
          break;
        case "labor_new":
          labor.add("直雇用（新人）", idx, cost);
          break;
        case "outsource":
          outsource.add(member.name, idx, cost);
          break;
        case "executive":
          sga.add("役員報酬", idx, cost);
          break;
        case "salary":
          sga.add("給料手当", idx, cost);
          break;
      }
      sga.add("法定福利費", idx, Number(member.monthly_social_insurance));

      if (member.profile_id && member.incentive_sales_unit && member.incentive_amount) {
        const memberSales = salesByStaff.get(member.profile_id)?.get(month) ?? 0;
        const steps = Math.floor(memberSales / Number(member.incentive_sales_unit));
        sga.add("インセンティブ", idx, steps * Number(member.incentive_amount));
      }
    });
  }

  // 経費
  for (const e of expenses) {
    const idx = monthIndex(e.expense_month.slice(0, 7));
    if (e.account === COGS_OUTSOURCE_ACCOUNT) outsource.add("外注（経費）", idx, Number(e.amount));
    else sga.add(e.account, idx, Number(e.amount));
  }

  // 取引先からの請求（税抜で計上）
  for (const v of vendorInvoices) {
    const idx = monthIndex(v.invoice_date.slice(0, 7));
    if (v.account === COGS_OUTSOURCE_ACCOUNT) {
      outsource.add(v.vendor_name || v.client?.name || "外注（取引先請求）", idx, Number(v.subtotal));
    } else {
      sga.add(v.account, idx, Number(v.subtotal));
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
};

const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
const ratio = (num: number, den: number) => (den === 0 ? null : num / den);

function valuesFor(lines: PlLine[], label: string): number[] {
  return lines.find((l) => l.label === label)?.values ?? zeros();
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

export function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

export function formatPercentValue(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(2)}%`;
}

export function memberKindLabel(kind: MemberKind): string {
  return MEMBER_KINDS.find((k) => k.value === kind)?.label ?? kind;
}
