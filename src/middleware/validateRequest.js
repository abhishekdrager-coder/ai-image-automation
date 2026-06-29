export function validateRequest(schema, source = 'body') {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || source,
        message: issue.message,
      }));

      const error = new Error('Request validation failed.');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = details;
      return next(error);
    }

    req.validated = req.validated || {};
    req.validated[source] = parsed.data;
    return next();
  };
}
