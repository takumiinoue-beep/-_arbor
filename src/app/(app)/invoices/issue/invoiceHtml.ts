import type { Client, CompanyBankAccount, CompanySettings } from "@/types/database";
import { computeTotals, type InvoiceForm, type InvoiceItemForm } from "./types";

export function buildInvoiceHTML(
  form: InvoiceForm,
  items: InvoiceItemForm[],
  clients: Client[],
  companyBankAccounts: CompanyBankAccount[],
  company: CompanySettings | null
): string {
  const { subtotal, tax10, tax8, total, subtotal10, subtotal8 } = computeTotals(items);
  const clientObj = clients.find((c) => c.id === Number(form.client_id));
  const bankObj = companyBankAccounts.find((b) => b.id === Number(form.company_bank_account_id));
  const clientName = clientObj?.name || form.client_name || "";

  const fmtNum = (n: number) => Math.round(n || 0).toLocaleString("ja-JP");
  const fmtYen = (n: number) => fmtNum(n) + "円";

  // PDF保存時のファイル名はブラウザがdocument.titleから決めるため、
  // 「◯月請求書_取引先名御中」になるようタイトルを組み立てる。
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const month = form.date ? Number(form.date.slice(5, 7)) : null;
  const titleParts = [month ? `${month}月請求書` : "請求書"];
  if (clientName) titleParts.push(`${clientName}御中`);
  const pageTitle = escapeHtml(titleParts.join("_"));

  const ROW_COUNT = 15;
  const filledRows = items
    .map(
      (item) => `
    <tr>
      <td class="td-desc">${item.description || ""}</td>
      <td class="td-r">${item.quantity ? fmtNum(Number(item.quantity)) : ""}</td>
      <td class="td-r">${item.unit_price ? fmtNum(Number(item.unit_price)) : ""}</td>
      <td class="td-r">${item.amount ? fmtNum(Math.round(item.amount)) : ""}</td>
    </tr>`
    )
    .join("");
  const emptyRows = Array(Math.max(0, ROW_COUNT - items.length))
    .fill('<tr><td class="td-desc">&nbsp;</td><td class="td-r"></td><td class="td-r"></td><td class="td-r"></td></tr>')
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${pageTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif;
    font-size: 11px;
    color: #000;
    padding: 28px 32px;
  }
  .title {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 16px;
    letter-spacing: 4px;
  }
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 14px;
  }
  .client-block { flex: 1; }
  .client-name { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
  .client-sub { font-size: 10px; color: #333; line-height: 1.5; }
  .meta-table { border-collapse: collapse; font-size: 10px; }
  .meta-table td { padding: 1px 6px; }
  .meta-label { color: #444; white-space: nowrap; }
  .meta-value { text-align: right; }
  .issuer-block {
    text-align: right;
    margin-bottom: 14px;
    font-size: 11px;
    line-height: 1.7;
  }
  .issuer-name { font-size: 13px; font-weight: bold; }
  .greeting { font-size: 10px; margin-bottom: 6px; }
  .subject-row { display: flex; align-items: baseline; margin-bottom: 8px; font-size: 14px; font-weight: bold; }
  .subject-label { margin-right: 16px; white-space: nowrap; }
  table.summary {
    width: 55%;
    border-collapse: collapse;
    margin-bottom: 6px;
    font-size: 11px;
  }
  table.summary th, table.summary td {
    border: 1px solid #000;
    padding: 5px 10px;
    text-align: right;
  }
  table.summary th { font-weight: bold; background: #f5f5f5; }
  .total-amount { font-size: 16px; font-weight: bold; white-space: nowrap; }
  table.payment {
    width: 55%;
    border-collapse: collapse;
    margin-bottom: 10px;
    font-size: 11px;
  }
  table.payment th, table.payment td {
    border: 1px solid #000;
    padding: 5px 10px;
  }
  table.payment th { font-weight: bold; background: #f5f5f5; text-align: center; }
  .bank-info { line-height: 1.7; }
  table.detail {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
    font-size: 11px;
  }
  table.detail th {
    border: 1px solid #000;
    padding: 5px 8px;
    text-align: center;
    font-weight: bold;
    background: #f5f5f5;
  }
  table.detail td { border: 1px solid #000; padding: 4px 8px; }
  .td-desc { width: 55%; }
  .td-r { text-align: right; width: 15%; }
  table.breakdown {
    margin-left: auto;
    border-collapse: collapse;
    font-size: 10px;
    width: 240px;
  }
  table.breakdown td {
    border: 1px solid #000;
    padding: 3px 10px;
  }
  table.breakdown .lbl { background: #f5f5f5; }
  .biko-label { font-size: 10px; font-weight: bold; border: 1px solid #000; padding: 3px 8px; background: #f5f5f5; display: inline-block; margin-bottom: -1px; }
  .biko-box { border: 1px solid #000; padding: 6px 8px; min-height: 40px; font-size: 10px; white-space: pre-wrap; }
</style>
</head>
<body>

  <div class="title">請求書</div>

  <div class="header-row">
    <div class="client-block">
      <div class="client-name">${clientName ? clientName + " 御中" : ""}</div>
      ${clientObj?.postal_code ? `<div class="client-sub">${clientObj.postal_code}</div>` : ""}
      ${clientObj?.address ? `<div class="client-sub">${clientObj.address}</div>` : ""}
    </div>
    <table class="meta-table">
      <tr><td class="meta-label">請求日</td><td class="meta-value">${form.date || ""}</td></tr>
      <tr><td class="meta-label">請求書番号</td><td class="meta-value">${form.invoice_number || ""}</td></tr>
      ${company?.invoice_number ? `<tr><td class="meta-label">登録番号</td><td class="meta-value">${company.invoice_number}</td></tr>` : ""}
    </table>
  </div>

  <div class="issuer-block">
    <div class="issuer-name">${company?.company_name || ""}</div>
    ${company?.representative ? `<div>${company.representative}</div>` : ""}
    ${company?.postal_code ? `<div>〒${company.postal_code}</div>` : ""}
    ${company?.address ? `<div>${company.address}</div>` : ""}
    ${company?.building_name ? `<div>${company.building_name}</div>` : ""}
  </div>

  <div class="greeting">下記の通りご請求申し上げます。</div>

  <div class="subject-row">
    <span class="subject-label">件名</span>
    <span>${form.subject || ""}</span>
  </div>

  <table class="summary">
    <tr>
      <th style="width:33%">小計</th>
      <th style="width:33%">消費税</th>
      <th style="width:34%">請求金額</th>
    </tr>
    <tr>
      <td>${fmtYen(subtotal)}</td>
      <td>${fmtYen(tax10 + tax8)}</td>
      <td class="total-amount">${fmtNum(total)}円</td>
    </tr>
  </table>

  <table class="payment">
    <tr>
      <th style="width:35%">入金期日</th>
      <th>振込先</th>
    </tr>
    <tr>
      <td style="text-align:center; vertical-align:middle;">${form.due_date || ""}</td>
      <td>
        ${bankObj ? `<div class="bank-info">${bankObj.bank_name}　${bankObj.bank_branch}支店<br>（${bankObj.account_type}）${bankObj.account_number}<br>${bankObj.account_holder}</div>` : ""}
      </td>
    </tr>
  </table>

  <table class="detail">
    <thead>
      <tr>
        <th class="td-desc">摘要</th>
        <th class="td-r">数量</th>
        <th class="td-r">単価</th>
        <th class="td-r">明細金額</th>
      </tr>
    </thead>
    <tbody>
      ${filledRows}
      ${emptyRows}
    </tbody>
  </table>

  <table class="breakdown">
    ${
      tax10 > 0
        ? `
    <tr>
      <td class="lbl">内訳　10%対象(税抜)</td>
      <td style="text-align:right">${fmtYen(subtotal10)}</td>
    </tr>
    <tr>
      <td class="lbl">　　　10%消費税</td>
      <td style="text-align:right">${fmtYen(tax10)}</td>
    </tr>`
        : ""
    }
    ${
      tax8 > 0
        ? `
    <tr>
      <td class="lbl">内訳　8%対象(税抜)※</td>
      <td style="text-align:right">${fmtYen(subtotal8)}</td>
    </tr>
    <tr>
      <td class="lbl">　　　8%消費税</td>
      <td style="text-align:right">${fmtYen(tax8)}</td>
    </tr>`
        : ""
    }
  </table>

  <div style="margin-top:10px;">
    <div class="biko-label">備考</div>
    <div class="biko-box">${form.notes || ""}</div>
  </div>

</body>
</html>`;
}
