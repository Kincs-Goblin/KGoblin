import { revalidateTag } from "next/cache";

import { handleWooWebhookRequest } from "@/shared/api/index.server";

export async function POST(request: Request, context: { params: Promise<{ brand: string }> }) {
  const { brand } = await context.params;
  return handleWooWebhookRequest(request, brand, {
    revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
  });
}
