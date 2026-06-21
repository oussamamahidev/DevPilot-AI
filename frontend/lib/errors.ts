export const COMMON_ERROR_MESSAGES = {
  backendUnreachable: "Backend is unreachable. Please check services.",
  forbidden: "You do not have permission to access this page.",
  notFound: "The requested resource was not found.",
  serverError: "The server returned an unexpected error. Please try again.",
  sessionExpired: "Your session expired. Please login again.",
} as const;

export function messageForHttpStatus(status: number) {
  if (status === 401) {
    return COMMON_ERROR_MESSAGES.sessionExpired;
  }
  if (status === 403) {
    return COMMON_ERROR_MESSAGES.forbidden;
  }
  if (status === 404) {
    return COMMON_ERROR_MESSAGES.notFound;
  }
  if (status >= 500) {
    return COMMON_ERROR_MESSAGES.serverError;
  }
  return `Request failed with status ${status}.`;
}

export function getFriendlyErrorMessage(error: unknown, fallback = "Unable to complete request.") {
  if (!error) {
    return fallback;
  }

  if (typeof error === "object") {
    const maybeError = error as { message?: unknown; name?: unknown; status?: unknown };

    if (maybeError.name === "ApiConnectionError") {
      return COMMON_ERROR_MESSAGES.backendUnreachable;
    }

    if (maybeError.name === "ApiRequestError" && typeof maybeError.status === "number") {
      return messageForHttpStatus(maybeError.status);
    }

    if (typeof maybeError.message === "string") {
      if (
        /failed to fetch|networkerror|load failed|connection refused|unable to connect/i.test(
          maybeError.message,
        )
      ) {
        return COMMON_ERROR_MESSAGES.backendUnreachable;
      }
      return maybeError.message;
    }
  }

  return fallback;
}
