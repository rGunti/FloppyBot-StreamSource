import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { SafeUrl } from '@angular/platform-browser';
import { ParamMap, Router, RouterOutlet } from '@angular/router';
import { Observable, combineLatest, filter, map, startWith, switchMap, tap } from 'rxjs';
import { SoundboardService } from './soundboard.service';
import { AsyncPipe } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { StreamSourceLoginArgs } from './soundboard.model';
import { StreamSourceService } from './stream-source.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroExclamationTriangle } from '@ng-icons/heroicons/outline';
import { Logger } from './utils/log';

const LOG = Logger.create('AppComponent');

function hasAllRequiredParams(params: ParamMap): boolean {
  return params.has('channel') && params.has('token');
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe, NgIconComponent],
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
    )
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

  public readonly hasRequiredQueryParams$ = this.queryParams$.pipe(
    map(hasAllRequiredParams),
  );
  public readonly statusVisible$ = this.queryParams$.pipe(
    map(params => params.has('status')),
  );
  public readonly warningVisible$ = combineLatest([this.soundboardService.connected, this.hasRequiredQueryParams$]).pipe(
    map(([connected, hasRequiredQueryParams]) => !connected || !hasRequiredQueryParams),
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
}
