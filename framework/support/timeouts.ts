import { setDefaultTimeout } from '@cucumber/cucumber';

const rawTimeout = process.env.DEFAULT_TIMEOUT;

function resolveTimeout(value: string | undefined): number {
  if (!value) return 60_000;

  const num = Number(value);

  if (isNaN(num) || num <= 0) return 60_000;

  if (num < 1000) return num * 1000;

  return num;
}

const resolvedTimeout = resolveTimeout(rawTimeout);

// 60 seconds default timeout for all steps/hooks
setDefaultTimeout(resolvedTimeout);

export {};