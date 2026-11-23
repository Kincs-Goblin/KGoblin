import type { NextRequest } from "next/server";

import {
  handleCartAddItem,
  handleCartRemoveItem,
  handleCartUpdateItem,
} from "@/shared/api/index.server";

export function POST(request: NextRequest) {
  return handleCartAddItem(request);
}

export function PATCH(request: NextRequest) {
  return handleCartUpdateItem(request);
}

export function DELETE(request: NextRequest) {
  return handleCartRemoveItem(request);
}
