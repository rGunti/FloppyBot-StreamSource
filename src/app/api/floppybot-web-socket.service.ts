import { Injectable } from '@angular/core';
import { Logger } from '../utils/log';
import { HubConnectionBuilder, ILogger, LogLevel } from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { CommandInvocation, StreamSourceLoginArgs } from './entities';

const LOG = Logger.create('FloppyBotWebSocketService');

class SignalRLogger implements ILogger {
  private readonly logger = Logger.create('SignalR');

  log(logLevel: LogLevel, message: string): void {
    switch (logLevel) {
      case LogLevel.Trace:
      case LogLevel.Debug:
        return this.logger.debug(message);
      case LogLevel.Information:
        return this.logger.info(message);
      case LogLevel.Warning:
        return this.logger.warn(message);
      case LogLevel.Error:
      case LogLevel.Critical:
        return this.logger.error(message);
      case LogLevel.None:
      default:
        break;
    }
  }
}

@Injectable({
  providedIn: 'root',
})
export class FloppyBotWebSocketService {
  private readonly hub = new HubConnectionBuilder()
    .withUrl(`${environment.endpoint}/hub/stream-source`)
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: () => 5000,
    })
    .configureLogging(new SignalRLogger())
    .build();

  constructor() {
    LOG.ctor();

    this.hub.onreconnected((id) => this.onReconnected(id));
    this.hub.onreconnecting((err) => this.onReconnecting(err));
    this.hub.onclose((err) => this.onClose(err));
    this.hub.on('SoundCommandReceived', (cmd) => this.onCommandReceived(cmd));

    setTimeout(() => {
      LOG.info('Initiating connection ...');
      this.hub
        .start()
        .then(() => {
          LOG.info('Connected to server');
          this.statusSubject.next(`Connected`);
          this.connectedSubject.next(true);
        })
        .catch((err) => {
          LOG.error('Failed to connect to server', err);
          this.statusSubject.next(`Connection failed: ${err.message}`);
          this.connectedSubject.next(false);
        });
    }, 1_000);
  }

  private readonly statusSubject = new Subject<string>();
  private readonly connectedSubject = new Subject<boolean>();
  private readonly commandReceivedSubject = new Subject<CommandInvocation>();

  readonly commandReceived$ = this.commandReceivedSubject.asObservable();
  readonly status$ = this.statusSubject.asObservable();
  readonly isConnected$ = this.connectedSubject.asObservable();

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

  private onReconnected(connectionId?: string) {
    LOG.info('Reconnected with ID', connectionId);
    this.statusSubject.next('Reconnected');
    this.connectedSubject.next(true);
  }

  private onReconnecting(err?: Error) {
    LOG.info('Reconnecting ...', err);
    this.statusSubject.next('Reconnecting ...');
    this.connectedSubject.next(false);
  }

  private onClose(err?: Error) {
    LOG.info('Closing connection ...', err);
    this.statusSubject.next('Connection closed');
    this.connectedSubject.next(false);
  }

  private onCommandReceived(command: CommandInvocation) {
    LOG.info('Received command invocation', command);
    this.statusSubject.next(`${command.invokedBy} invoked command ${command.commandName}`);
    this.commandReceivedSubject.next(command);
  }
}
