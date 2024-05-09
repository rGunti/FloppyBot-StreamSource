import { HttpInterceptorFn } from '@angular/common/http';
import { Logger } from '../utils/log';
import { tap } from 'rxjs';

const LOG = Logger.create('LoggingInterceptor');

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  LOG.debug('Request', req.method, req.url);
  return next(req).pipe(tap(res => LOG.debug('Response', req.method, req.url, res.type)));
};
