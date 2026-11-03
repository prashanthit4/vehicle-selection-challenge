import type { Request, Response } from 'express';
import { formatResultPage } from '@vehicle/shared/templates';
import { validateSubmission } from '../utils/validation';

/** POST /upload: validates the multipart form (parsed by Multer) and renders a plain-text page. */
export function uploadVehicle(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = validateSubmission({
    make: body.make,
    model: body.model,
    badge: body.badge,
    logbook: req.file && {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      content: req.file.buffer,
    },
  });

  if (!result.ok) {
    res.status(400).type('text/plain').send(result.error);
    return;
  }
  res.status(200).type('text/plain').send(formatResultPage(result.value));
}
