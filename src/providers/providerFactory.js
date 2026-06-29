import { config } from '../config.js';
import { ConfigError } from '../errors.js';
import { FreegenProvider } from './freegenProvider.js';

const providers = {
  freegen: () => new FreegenProvider(),
};

export function createProvider() {
  const factory = providers[config.app.provider];

  if (!factory) {
    throw new ConfigError(`Unsupported provider "${config.app.provider}".`);
  }

  return factory();
}
