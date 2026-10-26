"use client";

import { ActionButton } from "@/components/admin/kit";
import { markCashDepositedAction } from "@/server/actions/orders";

export function DepositButton({ riderId, riderName, amountLabel }: { riderId: string; riderName: string; amountLabel: string }) {
  return <ActionButton label="Mark handed in" variant="primary" confirm={`Did ${riderName} hand in ${amountLabel}? Count the cash first.`} action={() => markCashDepositedAction(riderId)} />;
}
