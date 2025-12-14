import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroExclamationTriangle } from '@ng-icons/heroicons/outline';
import { StreamSourceService } from './stream-source.service';
import { Logger } from '../utils/log';
import { map } from 'rxjs';

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

  readonly isConfigured$ = this.streamSource.hasChannelAndToken$;
  readonly status$ = this.streamSource.connectionState$;
  readonly isRunningInObs = this.streamSource.isRunningInObs;

  readonly currentAlert$ = this.streamSource.activeAlert$.pipe(
    map((alert) => {
      if (!alert) {
        return alert;
      }

      return {
        ...alert,
        classes: `visual-alert-container ${(alert.properties?.position ?? []).join('-')}`,
        styles: {
          'font-family': alert.properties?.font,
          color: alert.properties?.color,
          'text-shadow': alert.properties?.borderColor
            ? `-1px -1px 0 ${alert.properties?.borderColor}, 1px -1px 0 ${alert.properties?.borderColor}, -1px 1px 0 ${alert.properties?.borderColor}, 1px 1px 0 ${alert.properties?.borderColor}`
            : undefined,
        },
      };
    }),
  );

  ngOnInit(): void {
    LOG.onInit();
    this.streamSource.init();
  }

  skipAlert(): void {
    this.streamSource.skipCurrentAlert();
  }
}
