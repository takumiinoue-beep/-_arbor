"use client";

import { InlineQuantityEditor } from "./InlineQuantityEditor";
import { updateConfirmedQuantity } from "./actions";

export function ConfirmedQuantityEditor({
  projectId,
  confirmedQuantity,
  unitPrice,
}: {
  projectId: string;
  confirmedQuantity: number;
  unitPrice: number;
}) {
  return (
    <InlineQuantityEditor
      projectId={projectId}
      quantity={confirmedQuantity}
      unitPrice={unitPrice}
      onSave={updateConfirmedQuantity}
    />
  );
}
