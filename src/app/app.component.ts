import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { SafeUrl } from '@angular/platform-browser';
import { ParamMap, Router } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, filter, map, of, startWith, switchMap, take, tap } from 'rxjs';
import { SoundboardService } from './soundboard.service';
import { AsyncPipe } from '@angular/common';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { PayloadType, SoundCommandInvocation, StreamSourceLoginArgs } from './soundboard.model';
import { StreamSourceService } from './stream-source.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroExclamationTriangle } from '@ng-icons/heroicons/outline';
import { Logger } from './utils/log';

const LOG = Logger.create('AppComponent');

function hasAllRequiredParams(params: ParamMap): boolean {
  return params.has('channel') && params.has('token');
}

export interface VisualAlertInvocation {
  invocation: SoundCommandInvocation;
  payloadBlobUrl?: unknown;
  blob?: Blob;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, NgIconComponent],
  providers: [
    provideIcons({
      heroExclamationTriangle
    })
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [
    trigger(
      'inOutAnimation', 
      [
        transition(
          ':enter', 
          [
            style({ opacity: 0 }),
            animate('1s ease-out', 
                    style({ opacity: 1 }))
          ]
        ),
        transition(
          ':leave', 
          [
            style({ opacity: 1 }),
            animate('1s ease-in', 
                    style({ opacity: 0 }))
          ]
        )
      ]
    ),
    trigger('visualAlert', [
      state('false', style({ opacity: 0 })),
      state('true', style({ opacity: 1 })),
      transition('false => true', animate('1000ms ease-in')),
      transition('true => false', animate('1000ms ease-out'))
    ])
  ]
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly soundboardService = inject(SoundboardService);
  private readonly streamSourceService = inject(StreamSourceService);

  private readonly queryParams$ = this.router.routerState.root.queryParamMap;
  private readonly channelAndToken$: Observable<StreamSourceLoginArgs> = this.queryParams$.pipe(
    tap(params => {
      if (!hasAllRequiredParams(params)) {
        LOG.error('You are missing some query parameters. Please provide `channel` and `token`.');
      }
    }),
    filter(params => hasAllRequiredParams(params)),
    map(params => ({
      channel: params.get('channel')!,
      token: params.get('token')!,
    })),
  );
  private readonly showVisualAlert$ = new BehaviorSubject<boolean>(false);

  public readonly hasRequiredQueryParams$ = this.queryParams$.pipe(
    map(hasAllRequiredParams),
  );
  public readonly statusVisible$ = this.queryParams$.pipe(
    map(params => params.has('status')),
  );
  public readonly warningVisible$ = combineLatest([this.soundboardService.connected, this.hasRequiredQueryParams$]).pipe(
    map(([connected, hasRequiredQueryParams]) => !connected || !hasRequiredQueryParams),
  );

  public readonly visualAlert$: Observable<{ invocation: SoundCommandInvocation; payloadBlobUrl?: unknown, blob?: Blob }> = this.soundboardService.soundCommandReceived.pipe(
    filter(invocation => invocation.type === PayloadType.Visual),
    switchMap((invocation) => {
      if (invocation.payloadToPlay.startsWith('file://')) {
        const fileName = invocation.payloadToPlay.substring('file://'.length);
        return this.channelAndToken$.pipe(
          take(1),
          switchMap(({ channel, token }) => this.streamSourceService.getFile(channel, fileName, token)),
          map((blob) => {
            return { invocation, payloadBlobUrl: URL.createObjectURL(blob), blob };
          })
        );
      } else {
        return of({ invocation });
      }
    }),
    tap((invocation) => {
      LOG.info('Visual alert invoked:', invocation);
      this.showVisualAlert$.next(true);
      setTimeout(() => this.showVisualAlert$.next(false), 5_000);
    })
  );
  public readonly visualAlertVisible$ = this.showVisualAlert$.asObservable().pipe(
    tap((show) => LOG.info('Visual alert visible:', show)),
  );

  private readonly soundCommandCache = new Map<string, SafeUrl>();

  status$ = this.soundboardService.status.pipe(startWith('Connecting ...'), map(status => `${new Date().toISOString()} - ${status}`));
  isReady$ = this.soundboardService.connected;
  soundCommandReceived$ = this.soundboardService.soundCommandReceived;

  audioSource: SafeUrl | undefined;
  @ViewChild('audio') audioRef: ElementRef<HTMLAudioElement> = null!;

  ngOnInit(): void {
    LOG.onInit();

    this.soundboardService.connected.pipe(
      filter(connected => connected),
      switchMap(() => this.channelAndToken$),
    ).subscribe((loginArgs) => {
      LOG.info('Connected, logging in now ...', loginArgs);
      this.soundboardService.login(loginArgs);
    });

    this.soundboardService.soundCommandReceived.pipe(
      filter(invocation => invocation.type === PayloadType.Sound),
      switchMap((invocation) => this.channelAndToken$.pipe(
        map((loginArgs) => loginArgs.token),
        map((token) => {
          LOG.info('Received sound command ...');
          if (this.soundCommandCache.has(invocation.commandName)) {
            return this.soundCommandCache.get(invocation.commandName)!;
          }
  
          const url = this.streamSourceService.getFileUrl(invocation.invokedFrom, invocation.payloadToPlay, token);
          this.soundCommandCache.set(invocation.commandName, url);
          return url;
        }),
      )),
    ).subscribe((url) => this.playSound(url));
  }

  private playSound(source: SafeUrl): void {
    LOG.info('Playing sound', source);
    this.audioSource = source;
    this.audioRef.nativeElement.play();
  }

  private showVisualAlert(invocation: SoundCommandInvocation): void {
    LOG.info('Showing visual alert', invocation);
  }
}
