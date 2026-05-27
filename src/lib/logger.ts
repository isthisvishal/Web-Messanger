export function logError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}]`, error);
  } else {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${context}] ${message}`);
  }
}
