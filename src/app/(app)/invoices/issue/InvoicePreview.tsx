import type { CSSProperties } from "react";
import type { Client, CompanyBankAccount, CompanySettings } from "@/types/database";
import { computeTotals, type InvoiceForm, type InvoiceItemForm } from "./types";

const S: Record<string, CSSProperties> = {
  wrap: {
    fontFamily: "'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif",
    fontSize: 11,
    color: "#000",
    padding: "24px 28px",
    background: "#fff",
    border: "1px solid #ccc",
    minHeight: 600,
  },
  title: { textAlign: "center", fontSize: 18, fontWeight: "bold", marginBottom: 14, letterSpacing: 3 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  clientName: { fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  clientSub: { fontSize: 10, color: "#333", lineHeight: 1.5 },
  metaTd: { padding: "1px 6px", fontSize: 10 },
  issuer: { textAlign: "right", marginBottom: 12, fontSize: 10, lineHeight: 1.7 },
  issuerName: { fontSize: 12, fontWeight: "bold" },
  greeting: { fontSize: 10, marginBottom: 6 },
  subject: { display: "flex", alignItems: "baseline", marginBottom: 8, fontSize: 13, fontWeight: "bold", gap: 16 },
  tbl: { borderCollapse: "collapse", fontSize: 10 },
  th: { border: "1px solid #000", padding: "4px 8px", background: "#f5f5f5", fontWeight: "bold", textAlign: "center" },
  td: { border: "1px solid #000", padding: "3px 8px" },
  tdR: { border: "1px solid #000", padding: "3px 8px", textAlign: "right", width: "15%" },
  tdDesc: { border: "1px solid #000", padding: "3px 8px", width: "55%" },
};

export function InvoicePreview({
  form,
  items,
  clients,
  companyBankAccounts,
  company,
}: {
  form: InvoiceForm;
  items: InvoiceItemForm[];
  clients: Client[];
  companyBankAccounts: CompanyBankAccount[];
  company: CompanySettings | null;
}) {
  const { subtotal, tax10, tax8, total, subtotal10, subtotal8 } = computeTotals(items);
  const clientObj = clients.find((c) => c.id === Number(form.client_id));
  const bankObj = companyBankAccounts.find((b) => b.id === Number(form.company_bank_account_id));
  const clientName = clientObj?.name || form.client_name || "";
  const fmtN = (n: number) => Math.round(n || 0).toLocaleString("ja-JP");
  const fmtY = (n: number) => fmtN(n) + "円";

  const ROW_COUNT = 15;
  const emptyCount = Math.max(0, ROW_COUNT - items.length);

  return (
    <div style={S.wrap} className="select-none">
      <div style={S.title}>請求書</div>

      <div style={S.headerRow}>
        <div>
          <div style={S.clientName}>{clientName ? clientName + " 御中" : "（請求先未設定）"}</div>
          {clientObj?.address && <div style={S.clientSub}>{clientObj.address}</div>}
        </div>
        <table style={S.tbl}>
          <tbody>
            <tr>
              <td style={S.metaTd}>請求日</td>
              <td style={{ ...S.metaTd, textAlign: "right" }}>{form.date || ""}</td>
            </tr>
            <tr>
              <td style={S.metaTd}>請求書番号</td>
              <td style={{ ...S.metaTd, textAlign: "right" }}>{form.invoice_number || ""}</td>
            </tr>
            {company?.invoice_number && (
              <tr>
                <td style={S.metaTd}>登録番号</td>
                <td style={{ ...S.metaTd, textAlign: "right" }}>{company.invoice_number}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={S.issuer}>
        <div style={S.issuerName}>{company?.company_name || ""}</div>
        {company?.representative && <div>{company.representative}</div>}
        {company?.postal_code && <div>〒{company.postal_code}</div>}
        {company?.address && <div>{company.address}</div>}
        {company?.building_name && <div>{company.building_name}</div>}
      </div>

      <div style={S.greeting}>下記の通りご請求申し上げます。</div>

      <div style={S.subject}>
        <span>件名</span>
        <span>{form.subject || ""}</span>
      </div>

      <table style={{ ...S.tbl, width: "55%", marginBottom: 5 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: "33%" }}>小計</th>
            <th style={{ ...S.th, width: "33%" }}>消費税</th>
            <th style={{ ...S.th, width: "34%" }}>請求金額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...S.td, textAlign: "right" }}>{fmtY(subtotal)}</td>
            <td style={{ ...S.td, textAlign: "right" }}>{fmtY(tax10 + tax8)}</td>
            <td style={{ ...S.td, textAlign: "right", fontSize: 15, fontWeight: "bold" }}>{fmtN(total)}円</td>
          </tr>
        </tbody>
      </table>

      <table style={{ ...S.tbl, width: "55%", marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: "35%" }}>入金期日</th>
            <th style={S.th}>振込先</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...S.td, textAlign: "center", verticalAlign: "middle" }}>{form.due_date || ""}</td>
            <td style={{ ...S.td, lineHeight: 1.7 }}>
              {bankObj ? (
                <>
                  {bankObj.bank_name}　{bankObj.bank_branch}支店
                  <br />（{bankObj.account_type}）{bankObj.account_number}
                  <br />
                  {bankObj.account_holder}
                </>
              ) : (
                ""
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ ...S.tbl, width: "100%", marginBottom: 5 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: "55%", textAlign: "left" }}>摘要</th>
            <th style={{ ...S.th, width: "15%" }}>数量</th>
            <th style={{ ...S.th, width: "15%" }}>単価</th>
            <th style={{ ...S.th, width: "15%" }}>明細金額</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={S.tdDesc}>{item.description || ""}</td>
              <td style={S.tdR}>{item.quantity ? fmtN(Number(item.quantity)) : ""}</td>
              <td style={S.tdR}>{item.unit_price ? fmtN(Number(item.unit_price)) : ""}</td>
              <td style={S.tdR}>{item.amount ? fmtN(Math.round(item.amount)) : ""}</td>
            </tr>
          ))}
          {Array(emptyCount)
            .fill(0)
            .map((_, i) => (
              <tr key={`e${i}`}>
                <td style={S.tdDesc}>&nbsp;</td>
                <td style={S.tdR}></td>
                <td style={S.tdR}></td>
                <td style={S.tdR}></td>
              </tr>
            ))}
        </tbody>
      </table>

      <table style={{ ...S.tbl, marginLeft: "auto", width: 220, marginBottom: 8 }}>
        <tbody>
          {tax10 > 0 && (
            <>
              <tr>
                <td style={{ ...S.td, background: "#f5f5f5" }}>内訳　10%対象(税抜)</td>
                <td style={{ ...S.td, textAlign: "right" }}>{fmtY(subtotal10)}</td>
              </tr>
              <tr>
                <td style={{ ...S.td, background: "#f5f5f5" }}>　　　10%消費税</td>
                <td style={{ ...S.td, textAlign: "right" }}>{fmtY(tax10)}</td>
              </tr>
            </>
          )}
          {tax8 > 0 && (
            <>
              <tr>
                <td style={{ ...S.td, background: "#f5f5f5" }}>内訳　8%対象(税抜)※</td>
                <td style={{ ...S.td, textAlign: "right" }}>{fmtY(subtotal8)}</td>
              </tr>
              <tr>
                <td style={{ ...S.td, background: "#f5f5f5" }}>　　　8%消費税</td>
                <td style={{ ...S.td, textAlign: "right" }}>{fmtY(tax8)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      <div>
        <div
          style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: "bold",
            border: "1px solid #000",
            padding: "2px 8px",
            background: "#f5f5f5",
            marginBottom: -1,
          }}
        >
          備考
        </div>
        <div style={{ border: "1px solid #000", padding: "5px 8px", minHeight: 36, fontSize: 10, whiteSpace: "pre-wrap" }}>
          {form.notes || ""}
        </div>
      </div>
    </div>
  );
}
