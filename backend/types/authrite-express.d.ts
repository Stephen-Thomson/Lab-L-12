declare module 'authrite-express' {
    import { RequestHandler } from 'express';
  
    interface AuthriteOptions {
      serverPrivateKey: string;
      baseUrl: string;
    }
  
    function middleware(options: AuthriteOptions): RequestHandler;
    function authenticate(): RequestHandler;
  
    export { middleware, authenticate };
  }