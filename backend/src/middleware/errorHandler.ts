import type { NextFunction, Request, Response } from 'express';
import { UploadError } from './upload';

/** Last-resort handler. Upload/parse failures carry their own status; anything else is a 500. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  res.type('text/plain');
  if (err instanceof UploadError) {
    res.status(err.status).send(err.message);
    return;
  }
  console.error(err);
  res.status(500).send('Internal server error.');
}
