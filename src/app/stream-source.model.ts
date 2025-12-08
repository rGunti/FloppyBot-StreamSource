import { SafeUrl } from "@angular/platform-browser";
import { SoundCommandInvocation } from "./soundboard.model";

export interface SoundCommandAbstract {
    commandName: string;
    payloadToPlay: string;
}

export interface VisualAlertInvocation {
  invocation: SoundCommandInvocation;
  visualAlert?: VisualAlertProperties;
}

export declare type VisualAlertProperty = keyof VisualAlertProperties;
export const forbiddenVisualAlertProperties: VisualAlertProperty[] = [
    'image',
    'imageBlob',
];
export declare type VisualAlertPosition = [
    'top' | 'center' | 'bottom',
    'left' | 'center' | 'right',
];
export interface VisualAlertProperties {
    image: SafeUrl | string;
    imageBlob: Blob | null;
    position: VisualAlertPosition;
    // size: 'small' | 'medium' | 'large';
    duration: number;
    text: string;
}
