import { PORT } from './config.js';
import { createApp } from './app.js';

const app = createApp();
app.listen(PORT, () => console.log(`CloudNav refactored server running on port ${PORT}`));

export { app, createApp };
