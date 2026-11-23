import type { NextRequest } from "next/server";

import { handleCartApplyCoupon, handleCartRemoveCoupon } from "@/shared/api/index.server";

export function POST(request: NextRequest) {
  return handleCartApplyCoupon(request);
}

export function DELETE(request: NextRequest) {
  return handleCartRemoveCoupon(request);
}
