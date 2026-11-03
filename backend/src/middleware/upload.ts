import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  hasAllowedExtension,
  hasAllowedMimeType,
  LOGBOOK_FIELD,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
} from '@vehicle/shared/constants';
import { MAX_LOGBOOK_BYTES, UPLOAD_LIMITS } from '../config';

/** An upload problem with the status and plain-text message to send back. */
export class UploadError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const parseMultipart = multer({
  // Buffered in memory (never written to disk); limits.fileSize caps the buffer.
  storage: multer.memoryStorage(),
  limits: UPLOAD_LIMITS,
  // Reject disallowed types before the file body is buffered.
  fileFilter: (_req, file, accept) => {
    if (hasAllowedExtension(file.originalname) && hasAllowedMimeType(file.mimetype)) {
      accept(null, true);
    } else {
      accept(new UploadError(400, LOGBOOK_TYPE_MESSAGE));
    }
  },
}).single(LOGBOOK_FIELD);

function toUploadError(err: unknown): UploadError {
  if (err instanceof UploadError) return err;
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return new UploadError(413, logbookTooLargeMessage(MAX_LOGBOOK_BYTES));
  }
  // Any other limit breach (extra files/fields/parts, oversized fields, unexpected file field)
  // or an unparseable multipart body is the client's fault.
  return new UploadError(400, 'Malformed upload.');
}

/** Parses the multipart form into req.body (text fields) and req.file (the logbook). */
export function parseLogbookUpload(req: Request, res: Response, next: NextFunction) {
  parseMultipart(req, res, (err?: unknown) => (err ? next(toUploadError(err)) : next()));
}
