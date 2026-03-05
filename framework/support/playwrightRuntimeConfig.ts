import { BrowserContextOptions, LaunchOptions } from '@playwright/test';
import playwrightConfig, { frameworkRuntimeSettings } from '../playwright.config';
import { parseBooleanEnv, parseStringEnv } from './envUtils';

export type SupportedBrowser = 'chromium' | 'firefox' | 'webkit' | 'edge';

const useConfig = playwrightConfig.use ?? {};

function normalizeBrowser(input: string): SupportedBrowser {
  const lower = input.toLowerCase();

  switch (lower) {
    case 'firefox':
      return 'firefox';
    case 'webkit':
    case 'safari':
      return 'webkit';
    case 'edge':
      return 'edge';
    case 'chromium':
    case 'chrome':
      return 'chromium';
    default:
      return 'chromium';
  }
}

export function getDefaultBrowser(): SupportedBrowser {
  return normalizeBrowser(frameworkRuntimeSettings.defaultBrowser);
}

export function getHeadlessSetting(): boolean {
  return parseBooleanEnv(
    parseStringEnv(process.env.HEADLESS),
    frameworkRuntimeSettings.defaultHeadless
  );
}

export function getDefaultTimeoutMs(): number {
  return playwrightConfig.timeout ?? frameworkRuntimeSettings.defaultTimeoutMs;
}

export function resolveBrowserFromEnv(): SupportedBrowser {
  const raw = parseStringEnv(process.env.BROWSER);
  return raw ? normalizeBrowser(raw) : getDefaultBrowser();
}

export function getLaunchOptions(browserName: SupportedBrowser): LaunchOptions {
  const configuredLaunchOptions =
    (useConfig.launchOptions as LaunchOptions | undefined) ?? {};
  const headless = getHeadlessSetting();
  const isChromiumFamily = browserName === 'chromium' || browserName === 'edge';

  const configuredArgs = Array.isArray(configuredLaunchOptions.args)
    ? [...configuredLaunchOptions.args]
    : [];

  const args = isChromiumFamily
    ? configuredArgs
    : configuredArgs.filter(arg => arg !== '--start-maximized');

  const launchOptions: LaunchOptions = {
    ...configuredLaunchOptions,
    headless,
    args,
  };

  if (browserName === 'edge') {
    launchOptions.channel = launchOptions.channel ?? 'msedge';
  } else {
    delete launchOptions.channel;
  }

  return launchOptions;
}

export function getContextOptions(
  browserName: SupportedBrowser,
  width: number,
  height: number
): BrowserContextOptions {
  const {
    baseURL: _baseURL,
    headless: _headless,
    launchOptions: _launchOptions,
    video: _video,
    trace: _trace,
    screenshot: _screenshot,
    actionTimeout: _actionTimeout,
    navigationTimeout: _navigationTimeout,
    ...playwrightContextDefaults
  } = useConfig as Record<string, unknown>;

  const contextDefaults = playwrightContextDefaults as BrowserContextOptions;
  const contextOptions: BrowserContextOptions = {
    ...contextDefaults,
  };

  const headless = getHeadlessSetting();
  const isChromiumFamily = browserName === 'chromium' || browserName === 'edge';
  const isEdgeHeadless = browserName === 'edge' && headless;

  if (useConfig.viewport === null) {
    contextOptions.viewport =
      isChromiumFamily && !isEdgeHeadless
        ? null
        : { width, height };
  } else if (useConfig.viewport) {
    contextOptions.viewport = useConfig.viewport;
  } else {
    contextOptions.viewport = { width, height };
  }

  const videoSetting = useConfig.video;
  const shouldRecordVideo = videoSetting !== undefined && videoSetting !== 'off';

  if (shouldRecordVideo) {
    const configuredSize =
      typeof videoSetting === 'object' && videoSetting !== null && 'size' in videoSetting
        ? (videoSetting.size as { width: number; height: number } | undefined)
        : undefined;

    contextOptions.recordVideo = {
      dir: frameworkRuntimeSettings.videoDir,
      size: configuredSize ?? frameworkRuntimeSettings.videoSize,
    };
  }

  return contextOptions;
}
