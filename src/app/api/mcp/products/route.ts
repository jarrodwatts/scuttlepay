import { NextResponse, type NextRequest } from "next/server";

import { withApiKey } from "~/app/api/mcp/_middleware";
import { ErrorCode, ScuttlePayError, toApiResponse } from "@scuttlepay/shared";

export const GET = withApiKey(async (req: NextRequest, _ctx) => {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

  if (!query) {
    const err = new ScuttlePayError({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Missing search query parameter 'q'",
    });
    return NextResponse.json(toApiResponse(err), { status: err.httpStatus });
  }

  return NextResponse.json({ data: [], query, limit });
});
