// Única Vercel Function: vercel.json reescribe /api/* hacia acá y Hono enruta.
import { handle } from 'hono/vercel';
import { app } from '../server/app.js';

const handler = handle(app);
export const GET = handler;
export const POST = handler;
