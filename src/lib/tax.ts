// 消費税率。税込の単価が空のときは、税抜の単価にこの税率をかけて税込にする
export const CONSUMPTION_TAX_RATE = 0.1;

export const toTaxIncluded = (exclusive: number): number => Math.round(exclusive * (1 + CONSUMPTION_TAX_RATE));

// 税込の単価。登録されていれば（0より大きければ）それ、無ければ 税抜×1.1
export function priceInclusive(exclusive: number, inclusive?: number | null): number {
  const incl = Number(inclusive);
  return incl > 0 ? incl : toTaxIncluded(Number(exclusive));
}
