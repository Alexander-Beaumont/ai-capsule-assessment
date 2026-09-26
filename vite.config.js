import { defineConfig } from 'vite';
export default defineConfig({server:{port:5173,proxy:{'/api':'http://localhost:4000','/login':'http://localhost:4000','/logout':'http://localhost:4000'}}});
