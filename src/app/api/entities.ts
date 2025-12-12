import { SafeUrl } from '@angular/platform-browser';

// *** API ***
export interface SoundCommandAbstract {
  commandName: string;
  payloadToPlay: string;
}

// *** INTERNAL ***
export enum PayloadType {
  Sound = 0,
  Visual = 1,
}

export interface CommandInvocation {
  type: PayloadType;
  invokedBy: string;
  invokedFrom: string;
  commandName: string;
  payloadToPlay: string;
  invokedAt: string;
}

export interface StreamSourceLoginArgs {
  channel: string;
  token: string;
}

export interface AlertInvocation {
  invocation: CommandInvocation;
  properties?: AlertProperties;
}

export declare type AlertProperty = keyof AlertProperties;
export const forbiddenAlertProperties: AlertProperty[] = ['image', 'imageBlob'];
export declare type VisualAlertPosition = ['top' | 'center' | 'bottom', 'left' | 'center' | 'right'];
export interface AlertProperties {
  image: SafeUrl | string;
  imageBlob: Blob | null;
  position: VisualAlertPosition;
  // size: 'small' | 'medium' | 'large';
  duration: number;
  text: string;
}
