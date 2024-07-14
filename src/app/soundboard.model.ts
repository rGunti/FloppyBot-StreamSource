export interface SoundCommandInvocation {
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

export enum PayloadType {
    Sound = 0,
    Visual = 1,
}
