import { Bundle } from "./Bundle";

export type ServicesStore = {
  [key: string]: any;
};

export type ErrorType = {
  message: (data?: any) => string;
};

export enum KernelContext {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PREPRODUCTION = "preproduction",
  PRODUCTION = "production",
}

export type KernelParametersType = {
  debug: boolean;
  context: KernelContext;
  [key: string]: any;
};

export type KernelParametersPassableType = {
  debug?: boolean;
  context?: KernelContext;
  [key: string]: any;
};

export type KernelOptions = {
  parameters?: KernelParametersPassableType;
  bundles?: Bundle<any>[];
};
