import { NextResponse, type NextRequest } from "next/server";

import {
  validateApiKey,
  ApiKeyError,
  type ApiKeyContext,
} from "~/server/lib/validate-api-key";
import { ErrorCode, ScuttlePayError, toApiResponse } from "@scuttlepay/shared";

type RouteHandler = (
  req: NextRequest,
  ctx: ApiKeyContext,
) => Promise<NextResponse>;

export function withApiKey(handler: RouteHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const apiKeyCtx = await validateApiKey(
        req.headers.get("authorization"),
      );
      return await handler(req, apiKeyCtx);
    } catch (err) {
      if (err instanceof ApiKeyError) {
        return NextResponse.json(
          toApiResponse(
            new ScuttlePayError({
              code: ErrorCode.UNAUTHORIZED,
              message: err.message,
            }),
          ),
          { status: 401 },
        );
      }
      if (err instanceof ScuttlePayError) {
        return NextResponse.json(toApiResponse(err), {
          status: err.httpStatus,
        });
      }
      return NextResponse.json(
        toApiResponse(
          new ScuttlePayError({
            code: ErrorCode.INTERNAL_ERROR,
            message: "An unexpected error occurred",
          }),
        ),
        { status: 500 },
      );
    }
  };
}
