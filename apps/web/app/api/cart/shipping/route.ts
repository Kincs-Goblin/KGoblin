import type { NextRequest } from "next/server";

import {
  handleCartSelectShipping,
  handleCartUpdateShippingAddress,
} from "@/entities/cart/index.server";

export function POST(request: NextRequest) {
  return handleCartSelectShipping(request);
}

export function PATCH(request: NextRequest) {
  return handleCartUpdateShippingAddress(request);
}
