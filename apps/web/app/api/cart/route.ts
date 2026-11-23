import type { NextRequest } from "next/server";

import { handleCartClear, handleCartGet } from "@/shared/api/index.server";

export function GET(request: NextRequest) {
  return handleCartGet(request);
}

export function DELETE(request: NextRequest) {
  return handleCartClear(request);
}
