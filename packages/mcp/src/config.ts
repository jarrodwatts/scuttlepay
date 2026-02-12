function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it before starting the MCP server.`,
    );
  }
  return value;
}

export interface Config {
  apiUrl: string;
  apiKey: string;
}

export function loadConfig(): Config {
  const apiUrl = requireEnv("SCUTTLEPAY_API_URL").replace(/\/+$/, "");
  const apiKey = requireEnv("SCUTTLEPAY_API_KEY");

  try {
    new URL(apiUrl);
  } catch {
    throw new Error(
      `SCUTTLEPAY_API_URL is not a valid URL: "${apiUrl}"`,
    );
  }

  return { apiUrl, apiKey };
}
