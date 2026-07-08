"use client";

import { InlineQuantityEditor } from "./InlineQuantityEditor";
import { updateRateActual } from "./actions";

export function RateActualEditor({
  rateId,
  actualQuantity,
  unitPrice,
}: {
  rateId: string;
  actualQuantity: number;
  unitPrice: number;
}) {
  return (
    <InlineQuantityEditor
      projectId={rateId}
      quantity={actualQuantity}
      unitPrice={unitPrice}
      onSave={updateRateActual}
    />
  );
}
