import express from 'express';
import { UPLOAD_PATH } from '@vehicle/shared/constants';
import { MAX_BODY_SIZE } from './config';
import { uploadVehicle } from './controllers/submission';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// User-supplied text is echoed back, so never let the browser sniff it as HTML.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.urlencoded({ extended: false, limit: MAX_BODY_SIZE }));

// Plain browser form POST from the frontend; the response is the result page itself.
app.post(UPLOAD_PATH, uploadVehicle);

// Registered last so it catches errors from everything above.
app.use(errorHandler);
