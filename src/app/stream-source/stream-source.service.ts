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
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  concatMap,
  defer,
  distinctUntilChanged,
  EMPTY,
  filter,
  finalize,
  forkJoin,
  map,
  Observable,
  of,
  race,
  Subject,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
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

interface ChannelAndToken {
  channel: string;
  token: string;
}

declare type ExtendedCommandInvocation = CommandInvocation & ChannelAndToken;

@Injectable({
  providedIn: 'root',
})
export class StreamSourceService {
  private readonly cache = new Map<string, SafeUrl>();

  private readonly api = inject(FloppyBotApiService);
  private readonly router = inject(Router);
  private readonly webSocket = inject(FloppyBotWebSocketService);

  private readonly queryParams$ = this.router.routerState.root.queryParamMap;
  private readonly channelAndToken$: Observable<ChannelAndToken> = this.queryParams$.pipe(
    filter((params) => params.has('channel') && params.has('token')),
    map((params) => ({
      channel: params.get('channel')!,
      token: params.get('token')!,
    })),
  );

  readonly hasChannelAndToken$: Observable<boolean> = this.queryParams$.pipe(
    map((params) => params.has('channel') && params.has('token')),
  );

  private readonly activeAlertSubject = new BehaviorSubject<AlertInvocation | null>(null);
  readonly activeAlert$ = this.activeAlertSubject.asObservable();

  private readonly busySubject = new BehaviorSubject<boolean>(false);
  readonly busy$ = this.busySubject.asObservable();

  private readonly alertShortCircuitSubject = new Subject<void>();
  readonly alertShortCircuit$ = this.alertShortCircuitSubject.asObservable();

  readonly isRunningInObs: boolean;

  constructor() {
    LOG.ctor();

    this.isRunningInObs = navigator.userAgent.includes(' OBS/');

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

    combineLatest([
      this.webSocket.commandReceived$.pipe(filter((cmd) => cmd.type !== PayloadType.Command)),
      this.channelAndToken$,
    ])
      .pipe(
        tap(() => {
          LOG.debug('busySubject = true');
          this.busySubject.next(true);
        }),
        map(([cmd, channelAndToken]) => ({ ...cmd, ...channelAndToken })),
        concatMap((invocation) =>
          race([
            this.alertShortCircuit$.pipe(
              take(1),
              tap(() => LOG.debug('Alert short circuited')),
              tap(() => this.activeAlertSubject.next(null)),
            ),
            this.processCommand(invocation).pipe(finalize(() => LOG.debug('processCommand() finalized'))),
          ]).pipe(
            tap(() => LOG.debug('race(alertShortCircuit$, processCommand) completed, waiting for a moment')),
            concatMap(() => timer(1_000)),
            tap(() => LOG.debug('timer() completed')),
            catchError((err) => {
              LOG.error('Failed to process command', invocation, err);
              return EMPTY;
            }),
            finalize(() => LOG.debug('race(alertShortCircuit$, processCommand) finalized')),
          ),
        ),
        finalize(() => this.busySubject.next(false)),
      )
      .subscribe();

    this.webSocket.commandReceived$
      .pipe(
        filter((cmd) => cmd.type === PayloadType.Command),
        tap((cmd) => {
          switch (cmd.payloadToPlay) {
            case 'skip':
              this.skipCurrentAlert();
              break;
            default:
              LOG.error('Invalid command received', cmd.payloadToPlay);
              break;
          }
        }),
      )
      .subscribe();
  }

  readonly connectionState$ = combineLatest([this.webSocket.isConnected$, this.webSocket.status$]).pipe(
    map(([isConnected, status]) => ({ isConnected, status })),
  );

  init(): void {
    LOG.onInit();
  }

  skipCurrentAlert(): void {
    LOG.info('Skipping current alert');
    this.alertShortCircuitSubject.next();
  }

  private processCommand(cmd: ExtendedCommandInvocation): Observable<void> {
    switch (cmd.type) {
      case PayloadType.Sound:
        return this.playSound(cmd);
      case PayloadType.Visual:
        return this.showVisualAlert(cmd);
      default:
        return of(void 0);
    }
  }

  private getFile(fileName: string, channel: string, token: string): Observable<SafeUrl> {
    if (this.cache.has(fileName)) {
      LOG.info('Already knowing this file, getting it from cache', fileName);
      return of(this.cache.get(fileName)!);
    }

    LOG.info('Getting file from server', fileName);
    return this.api.getFile(channel, fileName, token).pipe(
      map((blob) => URL.createObjectURL(blob)),
      tap((url) => {
        LOG.info('Caching file', fileName, url);
        this.cache.set(fileName, url);
      }),
    );
  }

  private playSound(cmd: ExtendedCommandInvocation): Observable<void> {
    return defer(() =>
      of(cmd).pipe(
        switchMap((x) => this.getFile(x.payloadToPlay, x.channel, x.token)),
        switchMap((safeUrl) => this.playSoundFromUrl(safeUrl)),
        tap(() => LOG.debug('Play sound completed')),
        map(() => void 0),
        finalize(() => LOG.debug('playSound() finalized')),
      ),
    );
  }

  private playSoundFromUrl(safeUrl: SafeUrl | undefined): Observable<void> {
    LOG.debug('Start playing file', safeUrl);
    if (!safeUrl) {
      return new Observable<void>((x) => x.complete());
    }

    return new Observable<void>((sub) => {
      const audio = new Audio(safeUrl as string);
      audio.preload = 'auto';

      let completed = false;
      const complete = () => {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        if (!completed) {
          sub.next();
          sub.complete();
          completed = true;
        }
      };

      sub.add(() => {
        LOG.debug('Cleaning up', safeUrl);
        complete();
      });

      audio.onended = () => {
        LOG.debug('Audio playback ended for', safeUrl);
        complete();
      };
      audio.onerror = () => {
        LOG.debug('Audio playback failed for', safeUrl);
        sub.error(new Error('Audio playback failed'));
        sub.complete();
      };

      audio.play().catch((e) => {
        LOG.debug('Audio playback failed for', safeUrl, e);
        sub.error(e);
        sub.complete();
      });
    });
  }

  private showVisualAlert(cmd: ExtendedCommandInvocation): Observable<void> {
    return defer(() => {
      return this.parseVisualAlert(cmd).pipe(
        tap((alert) => this.activeAlertSubject.next(alert)),
        tap((alert) => LOG.debug('Start playing alert', alert)),
        switchMap((alert) =>
          forkJoin([
            timer(alert.properties?.duration ?? 5_000).pipe(tap(() => LOG.debug('Timer completed'))),
            of(alert.properties?.audio).pipe(
              switchMap((audioUrl) => (audioUrl ? this.playSoundFromUrl(audioUrl!) : new Promise<void>((r) => r()))),
              tap(() => LOG.debug('Audio playback completed')),
            ),
          ]).pipe(
            tap(() => LOG.debug('Alert completed')),
            map(() => alert),
          ),
        ),
        tap((alert) => LOG.debug('Alert finished playing', alert)),
        tap(() => this.activeAlertSubject.next(null)),
        map(() => void 0),
        finalize(() => LOG.debug('showVisualAlert() finalized')),
      );
    });
  }

  private parseVisualAlert(invocation: ExtendedCommandInvocation): Observable<AlertInvocation> {
    const payload = invocation.payloadToPlay;
    if (!payload.startsWith('file://')) {
      return of({ invocation });
    }

    const parsed = this.parseVisualAlertPayload(payload);
    return this.getFile(parsed.image as string, invocation.channel, invocation.token).pipe(
      map((url) => {
        const alertInvocation: AlertInvocation & ChannelAndToken = {
          invocation,
          properties: {
            ...parsed,
            image: url,
          },
          channel: invocation.channel,
          token: invocation.token,
        };
        return alertInvocation;
      }),
      switchMap((alertInvocation) => {
        const audioFile = alertInvocation.properties?.audio;
        if (!audioFile) {
          return of(alertInvocation as AlertInvocation);
        }

        return this.getFile(audioFile as string, alertInvocation.channel, alertInvocation.token).pipe(
          map((audioUrl) => ({
            ...alertInvocation,
            properties: alertInvocation.properties
              ? {
                  ...alertInvocation.properties,
                  audio: audioUrl,
                }
              : undefined,
          })),
        );
      }),
    );
  }

  private parseVisualAlertPayload(payload: string): AlertProperties {
    const split = payload.split('\n');
    const fileName = split[0].substring('file://'.length);
    const defaultProperties: AlertProperties = {
      image: fileName,
      position: ['center', 'center'],
      duration: 5_000,
      text: '',
      color: 'green',
      borderColor: 'black',
      font: 'Poppins',
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
