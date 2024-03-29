export interface SoundCommandInvocation {
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
