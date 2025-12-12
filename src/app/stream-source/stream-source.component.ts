import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroExclamationTriangle } from '@ng-icons/heroicons/outline';
import { StreamSourceService } from './stream-source.service';
import { Logger } from '../utils/log';

const LOG = Logger.create('StreamSourceComponent');

@Component({
  selector: 'flpy-stream-source',
  imports: [AsyncPipe, NgIconComponent],
  providers: [
    provideIcons({
      heroExclamationTriangle,
    }),
  ],
  templateUrl: './stream-source.component.html',
  styleUrl: './stream-source.component.scss',
})
export class StreamSourceComponent implements OnInit {
  private readonly streamSource = inject(StreamSourceService);

  @ViewChild('audio') private audioElementRef: ElementRef<HTMLAudioElement> = null!;

  readonly status$ = this.streamSource.connectionState$;
  readonly audioSource$ = this.streamSource.invokedSound$;

  ngOnInit(): void {
    LOG.onInit();
    this.streamSource.init();

    this.audioSource$.subscribe(() => {
      this.audioElementRef.nativeElement.pause();
      this.audioElementRef.nativeElement.currentTime = 0;
      setTimeout(() => {
        this.audioElementRef.nativeElement.play();
      });
    });
  }
}
