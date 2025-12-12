import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { map, Observable } from 'rxjs';
import { Logger } from '../utils/log';
import { SoundCommandAbstract } from './entities';
import { SafeUrl } from '@angular/platform-browser';

const LOG = Logger.create('FloppyBotApiService');

@Injectable({
  providedIn: 'root',
})
export class FloppyBotApiService {
  private readonly http = inject(HttpClient);
  private readonly apiServerUrl = `${environment.endpoint}/api/v2/stream-source`;

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
}
