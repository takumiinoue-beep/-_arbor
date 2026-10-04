"use client";

import { InlineQuantityEditor } from "../projects/InlineQuantityEditor";
import { updateOpConfirmedQuantity } from "./actions";

export function OpConfirmedQuantityEditor({
  projectId,
  rateId,
  staffId,
  confirmedQuantity,
  unitPrice,
}: {
  projectId: string;
  rateId: string | null;
  staffId: string;
  confirmedQuantity: number;
  unitPrice: number;
}) {
  return (
    <InlineQuantityEditor
      projectId={`${projectId}:${rateId ?? ""}:${staffId}`}
      quantity={confirmedQuantity}
      unitPrice={unitPrice}
      onSave={(_key, newQuantity) => updateOpConfirmedQuantity(projectId, rateId, staffId, newQuantity)}
    />
  );
}
