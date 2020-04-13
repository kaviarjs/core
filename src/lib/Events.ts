import { Bundle } from "./Bundle";
import { Event } from "./EventManager";

export class KernelBeforeInitEvent extends Event {}
export class KernelAfterInitEvent extends Event {}

type BundleRelatedEventType = {
  bundle: Bundle;
};

export class BundleBeforePrepareEvent extends Event<BundleRelatedEventType> {}

export class BundleAfterPrepareEvent extends Event<BundleRelatedEventType> {}

export class BundleBeforeInitEvent extends Event<BundleRelatedEventType> {}

export class BundleAfterInitEvent extends Event<BundleRelatedEventType> {}
