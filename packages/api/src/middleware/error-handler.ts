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
      err.httpStatus,
    );
  }

  console.error(`[${requestId}] Unhandled error:`, err);

  const wrapped = new ScuttlePayError({
    code: ErrorCode.INTERNAL_ERROR,
    message: "An internal error occurred",
    cause: err,
  });

  return c.json({ ...toApiResponse(wrapped), requestId }, 500);
};
