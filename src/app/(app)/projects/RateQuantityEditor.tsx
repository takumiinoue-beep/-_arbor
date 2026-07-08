"use client";

import { InlineQuantityEditor } from "./InlineQuantityEditor";
import { updateRateQuantity } from "./actions";

export function RateQuantityEditor({
  rateId,
  quantity,
  unitPrice,
}: {
  rateId: string;
  quantity: number;
  unitPrice: number;
}) {
  return (
    <InlineQuantityEditor
      projectId={rateId}
      quantity={quantity}
      unitPrice={unitPrice}
      onSave={updateRateQuantity}
    />
  );
}
