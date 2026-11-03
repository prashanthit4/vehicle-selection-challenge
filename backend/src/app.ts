import express from 'express';
import { uploadVehicle } from './controllers/submission';
import { errorHandler } from './middleware/errorHandler';

// The 1 MB logbook limit is enforced in validation. The body cap sits well above it because
// URL-encoding the text (spaces, newlines, punctuation → %XX) can roughly triple its size.
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE ?? '4mb';

export const app = express();

// User-supplied text is echoed back, so never let the browser sniff it as HTML.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.urlencoded({ extended: false, limit: MAX_BODY_SIZE }));

// Plain browser form POST from the frontend; the response is the result page itself.
app.post('/upload', uploadVehicle);

// Registered last so it catches errors from everything above.
app.use(errorHandler);
