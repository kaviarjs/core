import {
  ContainerInstance as BaseContainerInstance,
  ServiceIdentifier,
  ServiceNotFoundError,
} from "typedi";

export { Service, Inject, Token } from "typedi";

export class ContainerInstance extends BaseContainerInstance {
  get<T>(id: ServiceIdentifier<T>): T {
    try {
      return super.get(id);
    } catch (e) {
      // The reason we do this is to allow services that don't specify @Service()
      if (e instanceof ServiceNotFoundError) {
        if (typeof id === "function") {
          console.warn(
            `You have tried to get from the container a class (${id?.name}) which doesn't have @Service() specified. Please add it to remove this warning.`
          );
          this.set({
            id: id as Function,
            type: id as any,
          });

          return super.get(id);
        }
      }

      throw e;
    }
  }
}
