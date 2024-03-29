import { Injectable } from '@angular/core';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { environment } from '../environments/environment';
import { SoundCommandInvocation, StreamSourceLoginArgs } from './soundboard.model';
import { Observable, Subject, from, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SoundboardService {
  private readonly hub = new HubConnectionBuilder()
    .withUrl(`${environment.endpoint}/hub/stream-source`)
    .withAutomaticReconnect()
    .build();

  private readonly statusSubject = new Subject<string>();
  private readonly connectedSubject = new Subject<boolean>();
  private readonly soundCommandReceivedSubject = new Subject<SoundCommandInvocation>();

  constructor() {
    this.hub.onreconnected(() => {
      this.statusSubject.next('Reconnected');
      this.connectedSubject.next(true);
    });
    this.hub.onreconnecting(() => {
      this.statusSubject.next('Reconnecting ...');
      this.connectedSubject.next(false);
    });
    this.hub.onclose(() => {
      this.statusSubject.next('Connection closed');
      this.connectedSubject.next(false);
    });

    this.hub.on('SoundCommandReceived', (soundCommand: SoundCommandInvocation) => {
      this.statusSubject.next(`Sound command received: ${soundCommand.invokedBy} played ${soundCommand.commandName}`);
      this.soundCommandReceivedSubject.next(soundCommand);
    });

    this.hub.start()
      .then(() => {
        this.statusSubject.next('Connected');
        this.connectedSubject.next(true);
      })
      .catch((err) => {
        this.statusSubject.next(`Connection failed: ${err.message}`);
        this.connectedSubject.next(false);
      });
  }

  get soundCommandReceived() {
    return this.soundCommandReceivedSubject.asObservable();
  }

  get status() {
    return this.statusSubject.asObservable();
  }

  get connected() {
    return this.connectedSubject.asObservable();
  }

  async login(loginArgs: StreamSourceLoginArgs): Promise<void> {
    try {
      await this.hub.invoke('Login', loginArgs);
      this.statusSubject.next('Login successful, ready to take commands');
    } catch (err) {
      this.statusSubject.next(`Login failed: ${(err as any).message}`);
    }
  }
}
