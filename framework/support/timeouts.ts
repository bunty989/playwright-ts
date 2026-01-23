import { setDefaultTimeout } from '@cucumber/cucumber';
import { getDefaultTimeoutMs } from './playwrightRuntimeConfig';

setDefaultTimeout(getDefaultTimeoutMs());

export {};
