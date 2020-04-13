import { ErrorType } from "./defs";

export function raise(message: string): void {
  throw new Error(message);
}

export const Errors: { [key: string]: ErrorType } = {
  NO_BUNDLE_AFTER_INIT: {
    message: () =>
      `You cannot add a bundle after the kernel has been initialised`,
  },
  SINGLE_INSTANCE_BUNDLES: {
    message: () =>
      `You must not have multiple instances of the same bundle inside the kernel`,
  },
};
