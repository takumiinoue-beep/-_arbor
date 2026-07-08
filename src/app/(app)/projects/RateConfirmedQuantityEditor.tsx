"use client";

import { InlineQuantityEditor } from "./InlineQuantityEditor";
import { updateRateConfirmedQuantity } from "./actions";

export function RateConfirmedQuantityEditor({
  rateId,
  confirmedQuantity,
}: {
  rateId: string;
  confirmedQuantity: number;
}) {
  return (
    <InlineQuantityEditor projectId={rateId} quantity={confirmedQuantity} onSave={updateRateConfirmedQuantity} />
  );
}
