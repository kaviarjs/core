import { Bundle } from "./models/Bundle";
import { Event } from "./models/EventManager";

export class KernelBeforeInitEvent extends Event {}
export class KernelAfterInitEvent extends Event {}

interface BundleRelatedEventType {
  bundle: Bundle;
}

export class BundleBeforePrepareEvent extends Event<BundleRelatedEventType> {}

export class BundleAfterPrepareEvent extends Event<BundleRelatedEventType> {}

export class BundleBeforeInitEvent extends Event<BundleRelatedEventType> {}

export class BundleAfterInitEvent extends Event<BundleRelatedEventType> {}
