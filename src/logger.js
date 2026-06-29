const formatMessage = (level, message, extra) => {
  const timestamp = new Date().toISOString();
  const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
  return `[${timestamp}] [${level}] ${message}${suffix}`;
};

export const logger = {
  info(message, extra) {
    console.log(formatMessage('INFO', message, extra));
  },
  warn(message, extra) {
    console.warn(formatMessage('WARN', message, extra));
  },
  error(message, extra) {
    console.error(formatMessage('ERROR', message, extra));
  },
};
