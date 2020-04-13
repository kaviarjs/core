import { Kernel } from "./Kernel";
import { ContainerInstance } from "typedi";
import * as mergeDeep from "merge-deep";
import { Initialisable } from "./EventManager";
import { Errors, raise } from "./Errors";

export abstract class Bundle<T = any> {
  // We haven't made defaultConfig static because we want by default to use Partial<T>
  protected defaultConfig: Partial<T> = {};
  protected config: T;
  protected kernel: Kernel;

  constructor(config?: T) {
    if (config) {
      this.config = config;
    }
  }

  public async setup(kernel: Kernel) {
    this.kernel = kernel;
    // Note: we do this here because defaultConfig gets the value after construction()
    this.config = Object.assign({}, mergeDeep(this.defaultConfig, this.config));
    await this.validate(this.config);
  }

  get container(): ContainerInstance {
    return this.kernel.container;
  }

  // validate this.config, based on T
  public async validate(config?: T) {}

  // Gives the chance to: listen to other bundle events
  public async hook(): Promise<void> {}

  // There is an intermediary preparation phase which
  public async prepare(): Promise<void> {}

  // Here you bind your services, register application-level listeners
  public async init(): Promise<void> {}

  /**
   * Returns the service by its id
   * @param serviceId
   */
  public get<T = any>(serviceId: any): T {
    return this.container.get<T>(serviceId);
  }

  /**
   * Updates the config using deep merge strategy
   * @param config
   */
  public updateConfig(config: T) {
    this.config = mergeDeep(this.config, config);
  }

  /**
   * Overrides the config
   * @param config
   */
  public setConfig(config: T) {
    this.config = config;
  }

  /**
   * Provides you the configuration of the bundle
   */
  public getConfig(): T {
    return this.config;
  }

  /**
   * Instantiates the services as they most likely need to be ready and not lazy-loaded
   * @param services
   */
  protected async warmup(services: Array<{ new (): Initialisable }>) {
    for (let i = 0; i < services.length; i++) {
      const initialisable: Initialisable = this.container.get(services[i]);
      await initialisable.init();
    }
  }
}
