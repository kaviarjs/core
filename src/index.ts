import { KernelContext } from "./lib/defs";
import "reflect-metadata";

import { Kernel } from "./lib/Kernel";
import { Bundle } from "./lib/Bundle";
import { EventManager, Event, Listener } from "./lib/EventManager";

export { Service, Inject, ContainerInstance, Token } from "typedi";
export * from "./lib/Events";
export * from "./lib/defs";
export { Kernel, Bundle, EventManager, Event, Listener, KernelContext };
