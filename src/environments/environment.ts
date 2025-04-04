import { AppEnvironment } from "./environment.interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const environment: AppEnvironment = (window as any)['env'] as AppEnvironment;
