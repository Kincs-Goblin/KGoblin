import type { NextRequest } from "next/server";

import { handleCartClear, handleCartGet } from "@/entities/cart/index.server";

export function GET(request: NextRequest) {
  return handleCartGet(request);
}

export function DELETE(request: NextRequest) {
  return handleCartClear(request);
}
