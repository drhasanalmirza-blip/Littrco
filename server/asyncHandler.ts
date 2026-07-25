import type { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 does NOT forward a rejected promise from an `async` route handler to
// the error middleware. The rejection becomes an unhandled promise rejection, so:
//   - no response is ever written and the socket stays open,
//   - the browser's fetch never settles, and
//   - the UI sits on a spinner forever with no error to show.
//
// That is precisely how the "Generate pair code" button hung: a throw inside the
// handler produced silence rather than a 500. (On Node >= 15 an unhandled
// rejection can also terminate the process.)
//
// Wrap any async handler in this so a throw becomes a real 500 the client can
// render. Prefer this over ad-hoc try/catch in each route.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
