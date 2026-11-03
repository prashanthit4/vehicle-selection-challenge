import type { NextFunction, Request, Response } from 'express';

type HttpError = Error & { type?: string };

/** Last-resort handler. Unparseable and oversized bodies from the body parser land here. */
export function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction) {
  res.type('text/plain');
  if (err.type === 'entity.too.large') {
    res.status(413).send('Payload too large.');
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).send('Malformed request body.');
    return;
  }
  console.error(err);
  res.status(500).send('Internal server error.');
}
