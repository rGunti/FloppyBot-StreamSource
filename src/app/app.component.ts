import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { SafeUrl } from '@angular/platform-browser';
import { Router, RouterOutlet } from '@angular/router';
import { Observable, filter, map, startWith, switchMap } from 'rxjs';
import { SoundboardService } from './soundboard.service';
import { AsyncPipe } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { StreamSourceLoginArgs } from './soundboard.model';
import { StreamSourceService } from './stream-source.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe],
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
    filter(params => params.has('channel') && params.has('token')),
    map(params => ({
      channel: params.get('channel')!,
      token: params.get('token')!,
    })),
  );

  private readonly soundCommandCache = new Map<string, SafeUrl>();

  status$ = this.soundboardService.status.pipe(startWith('Connecting ...'), map(status => `${new Date().toISOString()} - ${status}`));
  isReady$ = this.soundboardService.connected;
  soundCommandReceived$ = this.soundboardService.soundCommandReceived;

  audioSource: SafeUrl | undefined;
  @ViewChild('audio') audioRef: ElementRef<HTMLAudioElement> = null!;

  ngOnInit(): void {
    this.soundboardService.connected.pipe(
      filter(connected => connected),
      switchMap(() => this.channelAndToken$),
    ).subscribe((loginArgs) => {
      this.soundboardService.login(loginArgs);
    });

    this.soundboardService.soundCommandReceived.pipe(
      switchMap((invocation) => this.channelAndToken$.pipe(
        map((loginArgs) => loginArgs.token),
        map((token) => {
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
    this.audioSource = source;
    this.audioRef.nativeElement.play();
  }
}
