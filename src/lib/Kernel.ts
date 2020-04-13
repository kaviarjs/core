import { Bundle } from "./Bundle";
import { ContainerInstance } from "typedi";
import { Errors, raise } from "./Errors";
import {
  KernelBeforeInitEvent,
  KernelAfterInitEvent,
  BundleBeforeInitEvent,
  BundleBeforePrepareEvent,
  BundleAfterInitEvent,
  BundleAfterPrepareEvent,
} from "./Events";
import { KernelOptions, KernelParametersType, KernelContext } from "./defs";
import { EventManager } from "./EventManager";

export const KernelDefaultParameters = {
  debug: true,
  context: KernelContext.DEVELOPMENT,
};

export class Kernel {
  readonly options: KernelOptions;
  readonly bundles: Bundle<any>[] = [];
  readonly parameters: KernelParametersType;
  readonly container: ContainerInstance;
  isInitialised = false;

  constructor(options: KernelOptions = {}) {
    this.options = options;
    this.parameters = options.parameters
      ? Object.assign({}, KernelDefaultParameters, options.parameters)
      : KernelDefaultParameters;

    this.container = this.createContainer();

    if (options.bundles) {
      options.bundles.map(bundle => this.addBundle(bundle));
    }

    this.container.set(ContainerInstance, this.container);
    this.container.set(Kernel, this);

    for (const parameterKey in this.parameters) {
      this.container.set(`%${parameterKey}%`, this.parameters[parameterKey]);
    }
  }

  /**
   * Initialising the Kernel
   */
  async init() {
    for (const bundle of this.bundles) {
      await bundle.setup(this);
    }

    for (const bundle of this.bundles) {
      await bundle.hook();
    }

    const manager = this.get<EventManager>(EventManager);

    await manager.emit(new KernelBeforeInitEvent());

    for (const bundle of this.bundles) {
      await manager.emit(new BundleBeforePrepareEvent({ bundle }));
      await bundle.prepare();
      await manager.emit(new BundleAfterPrepareEvent({ bundle }));
    }

    for (const bundle of this.bundles) {
      await manager.emit(new BundleBeforeInitEvent({ bundle }));
      await bundle.init();
      await manager.emit(new BundleAfterInitEvent({ bundle }));
    }

    this.isInitialised = true;
    await manager.emit(new KernelAfterInitEvent());
  }

  /**
   * Creates the container. Can give you a chance to extend it and apply middlewares
   */
  protected createContainer() {
    return new ContainerInstance(Symbol("KernelContainer"));
  }

  /**
   * @param classType
   */
  public hasBundle(classType: typeof Bundle): boolean {
    return Boolean(this.bundles.find(b => b instanceof classType));
  }

  /**
   * @param bundles
   */
  public addBundle(bundle: Bundle) {
    if (this.isInitialised) {
      raise(Errors.NO_BUNDLE_AFTER_INIT.message());
    }

    if (this.hasBundle(bundle.constructor as typeof Bundle)) {
      raise(Errors.SINGLE_INSTANCE_BUNDLES.message());
    } else {
      this.container.set(bundle.constructor, bundle);
    }

    this.bundles.push(bundle);
  }

  /**
   * Returns the service by its id
   * @param serviceId
   */
  public get<T = any>(serviceId: any) {
    return this.container.get<T>(serviceId);
  }
}
