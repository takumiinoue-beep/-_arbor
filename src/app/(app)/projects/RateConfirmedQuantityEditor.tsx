"use client";

import { InlineQuantityEditor } from "./InlineQuantityEditor";
import { updateRateConfirmedQuantity } from "./actions";

export function RateConfirmedQuantityEditor({
  rateId,
  confirmedQuantity,
  unitPrice,
}: {
  rateId: string;
  confirmedQuantity: number;
  unitPrice: number;
}) {
  return (
    <InlineQuantityEditor
      projectId={rateId}
      quantity={confirmedQuantity}
      unitPrice={unitPrice}
      onSave={updateRateConfirmedQuantity}
    />
  );
}
