"use client";

import { InlineQuantityEditor } from "./InlineQuantityEditor";
import { updateQuantity } from "./actions";

export function TargetQuantityEditor({
  projectId,
  quantity,
  unitPrice,
}: {
  projectId: string;
  quantity: number;
  unitPrice: number;
}) {
  return (
    <InlineQuantityEditor
      projectId={projectId}
      quantity={quantity}
      unitPrice={unitPrice}
      onSave={updateQuantity}
    />
  );
}
