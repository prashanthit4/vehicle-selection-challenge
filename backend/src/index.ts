// Must be the first import so env vars are set before app.ts reads them.
import 'dotenv/config';
import { app } from './app';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
