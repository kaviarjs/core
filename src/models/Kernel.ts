import { Bundle } from "./Bundle";
import { ContainerInstance } from "typedi";
import {
  KernelBeforeInitEvent,
  KernelAfterInitEvent,
  BundleBeforeInitEvent,
  BundleBeforePrepareEvent,
  BundleAfterInitEvent,
  BundleAfterPrepareEvent,
} from "../events";
import {
  IKernelOptions,
  IKernelParameters,
  KernelContext,
  IBundle,
  IBundleConstructor,
  KernelPhase,
  BundlePhase,
} from "../defs";
import { EventManager } from "./EventManager";
import {
  KernelFrozenException,
  BundleSingleInstanceException,
} from "../exceptions";

export const KernelDefaultParameters = {
  debug: true,
  context: KernelContext.DEVELOPMENT,
};

export class Kernel {
  readonly options: IKernelOptions;
  readonly bundles: Bundle<any>[] = [];
  readonly parameters: IKernelParameters;
  readonly container: ContainerInstance;
  protected phase: KernelPhase;

  constructor(options: IKernelOptions = {}) {
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
      bundle.setPhase(BundlePhase.SETUP);
      await bundle.setup(this);
    }

    this.phase = KernelPhase.HOOKING;
    for (const bundle of this.bundles) {
      bundle.setPhase(BundlePhase.HOOKING);
      await bundle.hook();
      bundle.setPhase(BundlePhase.HOOKED);
    }

    const manager = this.get<EventManager>(EventManager);

    this.phase = KernelPhase.PREPARING;
    await manager.emit(new KernelBeforeInitEvent());

    for (const bundle of this.bundles) {
      bundle.setPhase(BundlePhase.BEFORE_PREPARATION);
      await manager.emit(new BundleBeforePrepareEvent({ bundle }));

      await bundle.prepare();

      bundle.setPhase(BundlePhase.PREPARED);
      await manager.emit(new BundleAfterPrepareEvent({ bundle }));
    }

    this.phase = KernelPhase.INITIALISING;
    for (const bundle of this.bundles) {
      bundle.setPhase(BundlePhase.BEFORE_INITIALISATION);
      await manager.emit(new BundleBeforeInitEvent({ bundle }));

      await bundle.init();

      bundle.setPhase(BundlePhase.INITIALISED);
      await manager.emit(new BundleAfterInitEvent({ bundle }));
    }

    this.phase = KernelPhase.INITIALISED;

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
  public hasBundle(classType: IBundleConstructor): boolean {
    return Boolean(this.bundles.find(b => b instanceof classType));
  }

  /**
   * @param bundles
   */
  public addBundle(bundle: Bundle) {
    if (this.phase === KernelPhase.FROZEN) {
      throw new KernelFrozenException();
    }

    // We force it with .as because constructor is considered a function
    if (this.hasBundle(bundle.constructor as IBundleConstructor)) {
      throw new BundleSingleInstanceException();
    } else {
      this.container.set(bundle.constructor, bundle);
    }

    this.bundles.push(bundle);
  }

  /**
   * Add multiple bundles
   * @param bundles
   */
  public addBundles(bundles: Bundle[]) {
    bundles.forEach(bundle => this.addBundle(bundle));
  }

  /**
   * Returns the current state of kernele instantiation
   */
  public getPhase(): KernelPhase {
    return this.phase;
  }

  /**
   * Returns the service by its id
   * @param serviceId
   */
  public get<T = any>(serviceId: any) {
    return this.container.get<T>(serviceId);
  }
}
