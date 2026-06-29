export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'APP_ERROR';
    this.details = options.details;
    this.cause = options.cause;
  }
}

export class ValidationError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      ...options,
    });
  }
}

export class ProviderError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      statusCode: options.statusCode ?? 502,
      code: options.code ?? 'PROVIDER_ERROR',
      ...options,
    });
  }
}

export class ConfigError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      statusCode: 500,
      code: 'CONFIG_ERROR',
      ...options,
    });
  }
}
