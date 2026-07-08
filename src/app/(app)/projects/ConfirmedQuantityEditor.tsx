"use client";

import { InlineQuantityEditor } from "./InlineQuantityEditor";
import { updateConfirmedQuantity } from "./actions";

export function ConfirmedQuantityEditor({
  projectId,
  confirmedQuantity,
}: {
  projectId: string;
  confirmedQuantity: number;
}) {
  return (
    <InlineQuantityEditor projectId={projectId} quantity={confirmedQuantity} onSave={updateConfirmedQuantity} />
  );
}
