import { NextResponse } from "next/server";

import { withApiKey } from "~/app/api/mcp/_middleware";
import { getAllActiveMerchants } from "~/server/services/merchant.service";

export const GET = withApiKey(async () => {
  const merchants = await getAllActiveMerchants();
  return NextResponse.json({ data: merchants });
});
