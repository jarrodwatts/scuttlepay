import type { ErrorHandler } from "hono";
import {
  isScuttlePayError,
  toApiResponse,
  ScuttlePayError,
  ErrorCode,
} from "@scuttlepay/shared";

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get("requestId") ?? "unknown";

  if (isScuttlePayError(err)) {
    return c.json(
      { ...toApiResponse(err), requestId },
      err.httpStatus as 400 | 401 | 404 | 500 | 502,
    );
  }

  console.error(`[${requestId}] Unhandled error:`, err);

  const wrapped = new ScuttlePayError({
    code: ErrorCode.INTERNAL_ERROR,
    message: "An internal error occurred",
  });

  return c.json({ ...toApiResponse(wrapped), requestId }, 500);
};
