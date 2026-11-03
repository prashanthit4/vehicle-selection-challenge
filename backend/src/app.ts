import express from 'express';
import { UPLOAD_PATH } from '@vehicle/shared/constants';
import { uploadVehicle } from './controllers/submission';
import { errorHandler } from './middleware/errorHandler';
import { parseLogbookUpload } from './middleware/upload';

export const app = express();

// User-supplied text is echoed back, so never let the browser sniff it as HTML.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Plain browser multipart form POST from the frontend; the response is the result page itself.
// Multer runs only on this route, so no other endpoint accepts uploads.
app.post(UPLOAD_PATH, parseLogbookUpload, uploadVehicle);

// Registered last so it catches errors from everything above.
app.use(errorHandler);
