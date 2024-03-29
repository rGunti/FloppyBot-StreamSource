import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { SoundCommandAbstract } from './stream-source.model';
import { SafeUrl } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class StreamSourceService {
  private readonly apiServerUrl = `${environment.endpoint}/api/v1/stream-source`;

  constructor(
    private readonly http: HttpClient
  ) { }

  getSoundCommands(channel: string): Observable<SoundCommandAbstract[]> {
    return this.http.get<SoundCommandAbstract[]>(`${this.apiServerUrl}/${channel}/sound-commands`);
  }

  getFile(channel: string, fileName: string, apiKey: string): Observable<Blob> {
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
