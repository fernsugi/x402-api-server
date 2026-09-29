'use strict';

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Resolve valid live data before requesting payment, so provider failures are free. */
function prepareLive(load) {
  return async (req, res, next) => {
    try {
      req.liveData = await load(req);
      next();
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 503;
      if (status >= 500) console.error('[live-data] Provider unavailable:', error.message);
      res.status(status).json({
        error: status >= 500 ? 'Live data unavailable' : error.message,
        ...(status >= 500 ? { retryable: true } : {}),
      });
    }
  };
}

module.exports = { RequestError, prepareLive };
