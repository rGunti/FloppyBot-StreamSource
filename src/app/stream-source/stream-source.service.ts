import { inject, Injectable } from '@angular/core';
import {
  CommandInvocation,
  FloppyBotApiService,
  AlertInvocation,
  AlertProperties,
  AlertProperty,
  forbiddenAlertProperties,
  FloppyBotWebSocketService,
  PayloadType,
} from '../api';
import { Logger } from '../utils/log';
import { combineLatest, distinctUntilChanged, filter, map, Observable, of, shareReplay, switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';
import { SafeUrl } from '@angular/platform-browser';

const LOG = Logger.create('StreamSourceService');

const PROPERTY_PARSER: Partial<Record<AlertProperty | 'default', (value: string) => AlertProperties[AlertProperty]>> = {
  // image: (value: string) => value,
  duration: (value: string) => {
    if (value.toLowerCase().endsWith('ms')) {
      return parseInt(value.substring(0, value.length - 2), 10);
    } else if (value.toLowerCase().endsWith('s')) {
      return parseFloat(value.substring(0, value.length - 1)) * 1000;
    } else {
      return parseInt(value, 10);
    }
  },
  position: (value: string) => {
    const parts = value.split('-').map((part) => part.trim().toLowerCase()) as AlertProperties['position'];
    if (parts.length !== 2) {
      // if parsing fails, return center position
      LOG.warn('Failed to parse position value:', value);
      return ['center', 'center'];
    }
    return parts;
  },
  //size: (value: string) => value as VisualAlertProperties['size'],
  default: (value: string) => value,
};

@Injectable({
  providedIn: 'root',
})
export class StreamSourceService {
  private readonly soundCache = new Map<string, SafeUrl>();

  private readonly api = inject(FloppyBotApiService);
  private readonly router = inject(Router);
  private readonly webSocket = inject(FloppyBotWebSocketService);

  private readonly queryParams$ = this.router.routerState.root.queryParamMap;
  private readonly channelAndToken$ = this.queryParams$.pipe(
    filter((params) => params.has('channel') && params.has('token')),
    map((params) => ({
      channel: params.get('channel')!,
      token: params.get('token')!,
    })),
  );

  constructor() {
    LOG.ctor();

    this.webSocket.isConnected$
      .pipe(
        distinctUntilChanged(),
        filter((isConnected) => isConnected),
        switchMap(() => this.channelAndToken$),
        tap((loginArgs) => {
          LOG.info('Connected, logging in now ...', loginArgs);
          this.webSocket.login(loginArgs);
        }),
      )
      .subscribe();
  }

  readonly commandReceived$ = combineLatest([this.webSocket.commandReceived$, this.channelAndToken$]).pipe(
    map(([invocation, channelAndToken]) => ({
      invocation,
      ...channelAndToken,
    })),
  );

  readonly invokedSound$ = this.commandReceived$.pipe(
    filter((x) => x.invocation.type === PayloadType.Sound),
    switchMap((x) => {
      const file = x.invocation.payloadToPlay;
      if (this.soundCache.has(file)) {
        LOG.debug('Already knowing this file, getting it from cache', file);
        return of(this.soundCache.get(file));
      }
      return this.api.getFile(x.channel, file, x.token).pipe(
        map((blob) => URL.createObjectURL(blob)),
        tap((url) => this.soundCache.set(file, url)),
      );
    }),
    shareReplay(1),
  );

  readonly invokedVisual$ = this.commandReceived$.pipe(
    filter((x) => x.invocation.type === PayloadType.Visual),
    switchMap((x) => this.parseVisualAlert(x.invocation, x.channel, x.token)),
    shareReplay(1),
  );

  readonly connectionState$ = combineLatest([this.webSocket.isConnected$, this.webSocket.status$]).pipe(
    map(([isConnected, status]) => ({ isConnected, status })),
  );

  init(): void {
    LOG.onInit();
  }

  private parseVisualAlert(
    invocation: CommandInvocation,
    channel: string,
    apiKey: string,
  ): Observable<AlertInvocation> {
    const payload = invocation.payloadToPlay;
    if (!payload.startsWith('file://')) {
      return of({ invocation });
    }

    const parsed = this.parseVisualAlertPayload(payload);
    return this.api.getFile(channel, parsed.image as string, apiKey).pipe(
      map((blob) => ({
        invocation,
        blob,
        payloadBlobUrl: this.api.getFileUrl(channel, parsed.image as string, apiKey),
        visualAlert: {
          ...parsed,
          image: URL.createObjectURL(blob),
          imageBlob: blob,
        },
      })),
    );
  }

  private parseVisualAlertPayload(payload: string): AlertProperties {
    const split = payload.split('\n');
    const fileName = split[0].substring('file://'.length);
    const defaultProperties: AlertProperties = {
      image: fileName,
      imageBlob: null,
      position: ['center', 'center'],
      duration: 5_000,
      text: '',
    };
    return split
      .slice(1)
      .map((line) => line.split('='))
      .filter((parts) => parts.length === 2)
      .filter(([key]) => !forbiddenAlertProperties.includes(key as AlertProperty))
      .map(([key, value]) => [key, value] as [AlertProperty, string])
      .map(([key, value]) => {
        const parser = PROPERTY_PARSER[key] ?? PROPERTY_PARSER['default']!;
        return [key, parser(value)] as [AlertProperty, AlertProperties[AlertProperty]];
      })
      .reduce((acc, [key, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc as unknown as any)[key] = value;
        return acc;
      }, defaultProperties);
  }
}
