import { NextResponse, type NextRequest } from "next/server";

import { withApiKey } from "~/app/api/mcp/_middleware";

export const GET = withApiKey(async (req: NextRequest, _ctx) => {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

  if (!query) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Missing search query parameter 'q'" } },
      { status: 400 },
    );
  }

  // TODO: Integrate with Shopify storefront API in Task 3.x
  return NextResponse.json({
    data: [],
    query,
    limit,
    message: "Product search not yet connected to Shopify",
  });
});
