import type { Request, Response } from 'express';
import type { VehicleSubmission } from '@vehicle/shared/types';
import { validateSubmission } from '../utils/validation';

const formatResultPage = ({ make, model, badge, logbookText }: VehicleSubmission) =>
  `Make: ${make}\nModel: ${model}\nBadge: ${badge}\n\nLogbook:\n\n${logbookText}\n`;

/** POST /upload: validates the submitted form fields and renders them as a plain-text page. */
export function uploadVehicle(req: Request, res: Response) {
  const body = { ...req.body };
  // Browsers send textarea line breaks as CRLF; store and size-check the text as the file had it.
  if (typeof body.logbookText === 'string') {
    body.logbookText = body.logbookText.replace(/\r\n/g, '\n');
  }

  const result = validateSubmission(body);
  if (!result.ok) {
    res.status(400).type('text/plain').send(result.error);
    return;
  }
  res.status(200).type('text/plain').send(formatResultPage(result.value));
}
