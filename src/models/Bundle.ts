import { Kernel } from "./Kernel";
import { ContainerInstance } from "typedi";
import * as mergeDeep from "merge-deep";
import { IBundle, BundlePhase, IBundleConstructor } from "../defs";
import {
  BundleDependencyException,
  BundleFrozenException,
} from "../exceptions";

export abstract class Bundle<T = any> implements IBundle<T> {
  /**
   * Dev Note:
   * We haven't made defaultConfig static because we want by default to use Partial<T>
   * and static variables cannot reference class type paramters (TS2302)
   */
  protected defaultConfig: Partial<T> = {};
  protected config: T;
  protected kernel: Kernel;
  protected phase: BundlePhase;
  public readonly dependencies: Array<IBundleConstructor<any>> = [];

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

    // Check dependencies
    this.dependencies.forEach(dependency => {
      if (!kernel.hasBundle(dependency)) {
        throw new BundleDependencyException({
          requiredBundle: dependency.name,
        });
      }
    });
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
  public updateConfig(config: Partial<T>) {
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
   * Instantiates the services as they most likely need to be ready and not lazy-loaded.
   * If the service has an initialisation function (init), it will be run
   * @param services
   */
  protected async warmup(services: Array<any>) {
    for (let i = 0; i < services.length; i++) {
      const initialisable = this.container.get<any>(services[i]);

      // If it contains an init function just run it as well
      if (initialisable.init) {
        await initialisable.init();
      }
    }
  }

  /**
   * Do not call this yourself as you may break stuff, this should only be called by the Kernel.
   * @param phase
   */
  public setPhase(phase: BundlePhase) {
    if (this.phase === BundlePhase.FROZEN) {
      throw new BundleFrozenException();
    }

    this.phase = phase;
  }

  /**
   * For accessing public bundle's phases
   */
  public getPhase(): BundlePhase {
    return this.phase;
  }
}
