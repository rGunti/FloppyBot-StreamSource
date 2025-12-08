import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { forbiddenVisualAlertProperties, SoundCommandAbstract, VisualAlertInvocation, VisualAlertProperties } from './stream-source.model';
import { SafeUrl } from '@angular/platform-browser';
import { Logger } from './utils/log';
import { SoundCommandInvocation } from './soundboard.model';

const LOG = Logger.create('StreamSourceService');

const PROPERTY_PARSER: Partial<Record<keyof VisualAlertProperties | 'default', (value: string) => unknown>> = {
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
    const parts = value.split('-').map(part => part.trim().toLowerCase()) as VisualAlertProperties['position'];
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
  providedIn: 'root'
})
export class StreamSourceService {
  private readonly apiServerUrl = `${environment.endpoint}/api/v2/stream-source`;

  constructor(
    private readonly http: HttpClient
  ) {
    LOG.ctor();
  }

  getSoundCommands(channel: string): Observable<SoundCommandAbstract[]> {
    LOG.debug('getSoundCommands', channel);
    return this.http.get<SoundCommandAbstract[]>(`${this.apiServerUrl}/${channel}/sound-commands`);
  }

  getFile(channel: string, fileName: string, apiKey: string): Observable<Blob> {
    LOG.debug('getFile', channel, fileName);
    return this.http.get(`${this.apiServerUrl}/${channel}/file`, {
      headers: {
        'X-Api-Key': apiKey,
      },
      params: {
        fileName: fileName,
      },
      responseType: 'arraybuffer',
    }).pipe(
      map(a => [new Uint8Array(a, 0, a.byteLength)]),
      map(b => new Blob(b)),
    );
  }

  getFileUrl(channel: string, fileName: string, apiKey: string): SafeUrl {
    const params = new HttpParams()
      .set('fileName', fileName)
      .set('apiKey', apiKey);
    return `${this.apiServerUrl}/${channel}/file?${params.toString()}`;
  }

  parseVisualAlert(invocation: SoundCommandInvocation, channel: string, apiKey: string): Observable<VisualAlertInvocation> {
    const payload = invocation.payloadToPlay;
    if (!payload.startsWith('file://')) {
      return of({ invocation });
    }

    const parsed = this.parseVisualAlertPayload(payload);
    return this.getFile(channel, parsed.image as string, apiKey).pipe(
      map((blob) => ({
        invocation,
        blob,
        payloadBlobUrl: this.getFileUrl(channel, parsed.image as string, apiKey),
        visualAlert: {
          ...parsed,
          image: URL.createObjectURL(blob),
          imageBlob: blob,
        },
      })),
    );
  }

  private parseVisualAlertPayload(payload: string): VisualAlertProperties {
    const split = payload.split('\n');
    const fileName = split[0].substring('file://'.length);
    const defaultProperties: VisualAlertProperties = {
      image: fileName,
      imageBlob: null,
      position: ['center', 'center'],
      duration: 5_000,
      text: '',
    };
    return split.slice(1)
      .map(line => line.split('='))
      .filter(parts => parts.length === 2)
      .filter(([key, ]) => !forbiddenVisualAlertProperties.includes(key as keyof VisualAlertProperties))
      .map(([key, value]) => [key, value] as [keyof VisualAlertProperties, string])
      .map(([key, value]) => {
        const parser = PROPERTY_PARSER[key] ?? PROPERTY_PARSER['default']!;
        return [key, parser(value)] as [keyof VisualAlertProperties, VisualAlertProperties[keyof VisualAlertProperties]];
      })
      .reduce((acc, [key, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc as unknown as any)[key] = value;
        return acc;
      }, defaultProperties);
  }
}
