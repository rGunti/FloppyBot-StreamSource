import { Injectable } from '@angular/core';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { environment } from '../environments/environment';
import { SoundCommandInvocation, StreamSourceLoginArgs } from './soundboard.model';
import { Subject } from 'rxjs';
import { Logger } from './utils/log';

const LOG = Logger.create('SoundboardService');

@Injectable({
  providedIn: 'root'
})
export class SoundboardService {
  private readonly hub = new HubConnectionBuilder()
    .withUrl(`${environment.endpoint}/hub/stream-source`)
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: () => 5000
    })
    .build();

  private readonly statusSubject = new Subject<string>();
  private readonly connectedSubject = new Subject<boolean>();
  private readonly soundCommandReceivedSubject = new Subject<SoundCommandInvocation>();

  constructor() {
    LOG.ctor();

    this.hub.onreconnected(() => {
      LOG.info('Reconnected');
      this.statusSubject.next('Reconnected');
      this.connectedSubject.next(true);
    });
    this.hub.onreconnecting(() => {
      LOG.info('Reconnecting ...');
      this.statusSubject.next('Reconnecting ...');
      this.connectedSubject.next(false);
    });
    this.hub.onclose(() => {
      LOG.info('Closing connection ...');
      this.statusSubject.next('Connection closed');
      this.connectedSubject.next(false);
    });

    this.hub.on('SoundCommandReceived', (soundCommand: SoundCommandInvocation) => {
      LOG.info('Received sound command', soundCommand);
      this.statusSubject.next(`Sound command received: ${soundCommand.invokedBy} played ${soundCommand.commandName}`);
      this.soundCommandReceivedSubject.next(soundCommand);
    });

    setTimeout(() => {
      LOG.info('Initiating connection ...');
      this.hub.start()
        .then(() => {
          LOG.info('Connected to server');
          this.statusSubject.next('Connected');
          this.connectedSubject.next(true);
        })
        .catch((err) => {
          LOG.error('Failed to connect to server', err);
          this.statusSubject.next(`Connection failed: ${err.message}`);
          this.connectedSubject.next(false);
        });
    }, 1000);
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
    LOG.info('Logging in ...', loginArgs);

    try {
      await this.hub.invoke('Login', loginArgs);
      this.statusSubject.next('Login successful, ready to take commands');
    } catch (err) {
      LOG.error('Failed to login', { err, loginArgs });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.statusSubject.next(`Login failed: ${(err as unknown as any).message}`);
    }
  }
}
