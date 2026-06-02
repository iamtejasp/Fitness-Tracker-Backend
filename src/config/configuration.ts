type EnvironmentVariables = Record<string, string | undefined>;

const requiredEnvironmentVariables = [
  'MONGO_URI',
  'JWT_SECRET',
  'GEMINI_API_KEY',
] as const;

export function validateEnvironment(
  config: EnvironmentVariables,
): EnvironmentVariables {
  const missingVariables = requiredEnvironmentVariables.filter(
    (key) => !config[key],
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  return config;
}

export default () => ({
  app: {
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: 'api/v1',
    corsOrigins:
      process.env.CORS_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? [],
  },
  database: {
    uri: process.env.MONGO_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  },
});
