import { Service, ContainerInstance, Inject } from "typedi";

export type EventClassType = { new (): Event };
export type EventHandlerType = (event: Event<any>) => void;
export type GlobalHandlerType<E, T> = (event: E, data: T) => void;
export type ListenerStorage = {
  order: number;
  handler: EventHandlerType;
};

export type HandlerOptions = { order: number };
export const HandlerOptionsDefaults = { order: 0 };

export interface Initialisable {
  init(): void;
}

export class Event<T = any> {
  public data: T;

  constructor(data?: T) {
    if (data) {
      this.data = data;
    }
  }

  async validate() {}

  get name() {
    return this.constructor.name;
  }
}

@Service()
export class EventManager {
  protected listeners = new Map<typeof Event, ListenerStorage[]>();
  protected globalListeners: ListenerStorage[] = [];

  /**
   * Emit to all listeners of this event
   * @param data
   */
  public async emit(event: Event): Promise<void> {
    await event.validate();

    let listeners = this.getListeners(
      event.constructor as EventClassType
    ).slice(0);

    // This is not a very smart idea, to always sort by the global listeners
    // But we need a way to blend the global listeners smartly so they are sorted when they're added
    // And they need to work when there is no listener too.
    // However, sorting should be quick since both arrays are already sorted.
    if (this.globalListeners.length) {
      listeners.push(...this.globalListeners);
      this.sortListeners(listeners);
    }

    for (const listener of listeners) {
      await listener.handler(event);
    }
  }

  /**
   * Adds the handler to this event
   */
  public addListener(
    eventClass: EventClassType,
    handler: EventHandlerType,
    options: HandlerOptions = HandlerOptionsDefaults
  ): EventManager {
    const listeners = this.getListeners(eventClass);

    listeners.push({
      handler,
      order: options.order,
    });

    this.sortListeners(listeners);

    return this;
  }

  public addGlobalListener(
    handler: EventHandlerType,
    options: HandlerOptions = HandlerOptionsDefaults
  ) {
    this.globalListeners.push({
      order: options.order,
      handler,
    });

    this.sortListeners(this.globalListeners);

    return this;
  }

  protected getListeners(eventClass: EventClassType): ListenerStorage[] {
    if (!this.listeners.has(eventClass)) {
      this.listeners.set(eventClass, []);
    }

    return this.listeners.get(eventClass) || [];
  }

  /**
   * @param array
   */
  protected sortListeners(array: ListenerStorage[]) {
    array.sort((a, b) => {
      return a.order - b.order;
    });
  }

  /**
   * @param handler
   */
  public removeGlobalListener(handler: EventHandlerType) {
    this.globalListeners = this.globalListeners.filter(listener => {
      listener.handler !== handler;
    });

    return this;
  }

  /**
   * Removes the handler from this event.
   */
  public removeListener(
    eventClass: EventClassType,
    handler: EventHandlerType
  ): EventManager {
    let listeners = this.listeners.get(eventClass);

    if (!listeners) {
      return this;
    }

    listeners = listeners.filter(listener => listener.handler !== handler);

    this.listeners.set(eventClass, listeners);

    return this;
  }
}

@Service()
export class Listener implements Initialisable {
  @Inject(() => EventManager)
  protected manager: EventManager;

  @Inject(() => ContainerInstance)
  protected container: ContainerInstance;

  public init() {
    throw new Error(`init() method not implemented`);
  }

  /**
   * Listen to events
   * @param eventClass This is the event class, make sure you don't use an instance here
   * @param handler This is the function that handles the event emission
   * @param options Options
   */
  protected on(
    eventClass: EventClassType,
    handler: EventHandlerType,
    options: HandlerOptions = HandlerOptionsDefaults
  ) {
    this.manager.addListener(eventClass, handler, options);
  }

  /**
   * Returns the service by its id
   * @param serviceId
   */
  public get<T = any>(serviceId: any): T {
    return this.container.get<T>(serviceId);
  }
}
