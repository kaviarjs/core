import { Service } from "typedi";
import {
  IListenerStorage,
  IEventConstructor,
  EventHandlerType,
  IEventHandlerOptions,
} from "../defs";

export const HandlerOptionsDefaults = { order: 0 };

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
  protected listeners = new Map<typeof Event, IListenerStorage[]>();
  protected globalListeners: IListenerStorage[] = [];

  /**
   * Emit to all listeners of this event
   * @param data
   */
  public async emit(event: Event): Promise<void> {
    await event.validate();

    let listeners = this.getListeners(
      event.constructor as IEventConstructor
    ).slice(0);

    // This is not a very smart idea, to always sort by the global listeners
    // But we need a way to blend the global listeners smartly so they are sorted when they're added
    // And they need to work when there is no listener too.
    // However, sorting should be quick since both arrays are already sorted.
    if (this.globalListeners.length) {
      listeners.push(...this.globalListeners);
      this.sortListeners(listeners);
    }

    let ok;
    for (const listener of listeners) {
      ok = true;
      if (listener.filter) {
        ok = listener.filter(event);
      }

      if (ok) {
        await listener.handler(event);
      }
    }
  }

  /**
   * Adds the handler to this event
   */
  public addListener(
    eventClass: IEventConstructor,
    handler: EventHandlerType,
    options: IEventHandlerOptions = HandlerOptionsDefaults
  ): EventManager {
    const listeners = this.getListeners(eventClass);

    listeners.push({
      handler,
      order: options.order,
      filter: options.filter,
    });

    this.sortListeners(listeners);

    return this;
  }

  /**
   * Listen to all events
   *
   * @param handler
   * @param options
   */
  public addGlobalListener(
    handler: EventHandlerType,
    options: IEventHandlerOptions = HandlerOptionsDefaults
  ) {
    this.globalListeners.push({
      order: options.order,
      filter: options.filter,
      handler,
    });

    this.sortListeners(this.globalListeners);

    return this;
  }

  protected getListeners(eventClass: IEventConstructor): IListenerStorage[] {
    if (!this.listeners.has(eventClass)) {
      this.listeners.set(eventClass, []);
    }

    return this.listeners.get(eventClass) || [];
  }

  /**
   * @param array
   */
  protected sortListeners(array: IListenerStorage[]) {
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
    eventClass: IEventConstructor,
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