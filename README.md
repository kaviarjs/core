<h1 align="center">KAVIAR CORE</h1>

<p align="center">
  <a href="https://travis-ci.org/kaviarjs/core">
    <img src="https://api.travis-ci.org/kaviarjs/core.svg?branch=master" />
  </a>
  <a href="https://coveralls.io/github/kaviarjs/core?branch=master">
    <img src="https://coveralls.io/repos/github/kaviarjs/core/badge.svg?branch=master" />
  </a>
</p>

<br />
<br />

A powerful and lightweight module composition strategy responsible for orchestrating your logic, enabling you to easily respect SOLID principles within your infinitely-scalable app.

## Install

```bash
npm install --save @kaviar/core
```

## Documentation

Table of Contents:

- [Basic Setup](#basic-setup)
- [Dependency Injection](#dependency-injection)
- [Event Manager](#event-manager)
- [Bundles](#bundles)
- [Listening to Events](#listening-to-events)
- [Hacking Bundles](#hacking-bundles)

## Basic Setup

The kernel is what orchestrates all of your bundles.

```typescript
import { Kernel } from "@kaviar/core";

const kernel = new Kernel();
```

A sample of bundle:

```typescript
import { Bundle } from "@kaviar/core";

class AppBundle extends Bundle {
  async init() {
    // Start your API
    // Register Event Listeners
    // etc
  }
}
```

We can now add bundles to our `kernel` until it gets initialised:

```typescript
const kernel = new Kernel({
  bundles: [new OtherBundle()],
  parameters: {
    ANYTHING: "you like",
  },
});

// Add bundles outside constructor
kernel.addBundle(new MyBundle());
kernel.init(); // you can no longer add bundles after initialisation
```

Initialisation process prepares and initialiases all the bundles registered inside it. You can regard Bundles as groups of independent logic or strongly separated concerns.

## Dependency Injection

We never instantiate via `new` we only fetch instances of our services through the container.

```typescript
import { Service } from "@kaviar/core";

const container = kernel.container;

@Service()
class B {}

@Service()
// Automatic injection
class A {
  constructor(b: B) {
    this.b = b;
  }
}
```

The idea here is that you never use `new` for our services, instead you do this:

```typescript
const a = container.get(A); // note, A is the className, a is the instance
(instanceof a.b) === B; // true, a.b is an instance of B
```

If you want to benefit of autocompletion, there are 2 ways:

```typescript
const a = container.get<A>(A);
const a: A = container.get(A);
```

Services are singletons, meaning it instantiates once:

```typescript
const a = container.get<A>(A);
a === container.get<A>(A); // true
```

If you specify a list of parameters:

```js
new Kernel({
  parameters: {
    debug: true,
  },
});

// You can get parameters via the getter, wrapping the key in %s
const { domain, apiKey } = container.get("%debug%");
```

You will have access to the container from within your bundle lifecycle functions. This example was just for illustrating the concept of DI, you are not going to use the `kernel.container`

You can inject parameters from kernel, or other services like this:

```typescript
@Service
class A {
  // Inject via property, note it uses a function
  @Inject(() => "%debug%")
  protected isDebug: boolean;

  // Inject via constructor
  constructor(@Inject("%context%") context: KernelContext) {
    // Do something based on the context
  }
}
```

## Event Manager

Kaviar encourages event-driven applications. We encourage services to dispatch events rather than calling other services.

```typescript
import { EventManager, Event } from "@kaviar/core";

class UserCreatedEvent extends Event<{
  userId: string;
}> {}

const manager = container.get(EventManager);

manager.addListener(UserCreatedEvent, (e: UserCreatedEvent) => {
  console.log(e.data.userId);
});

manager.emit(
  new UserCreatedEvent({
    userId: "XXX",
  })
);
```

Note that you also have `removeListener`, `addGlobalListener` and `removeGlobalListener`, also you can set the order in which the handlers are executed:

```typescript
manager.addListener(
  UserCreatedEvent,
  async (e: UserCreatedEvent) => {
    // Do something before any other handler executes
  },
  {
    order: -1000, // the lowest get executed first, by default order = 0
  }
);
```

## Bundles

Ok, now that you've learned the basics, let's understand where exactly to put these services and events, by exploring a bundle.

```typescript
export type MyBundleConfigType = {
  subscriptionFee: number;
  currency: string;
};

class MyBundle extends Bundle<MyBundleConfigType> {}

// You benefit of autocompletion in the constructor
const bundle = new MyBundle({
  subscriptionFee: 10.0,
  currency: "USD",
});
```

Above you see a bundle that stores the configuration inside `config` property of the Bundle, and that's about it, it does nothing else until the kernel is booted up.

```typescript
kernel.addBundle(bundle);
kernel.init();
```

Bundles have the following lifecycle:

```typescript
class MyBundle extends Bundle<MyBundleConfig> {
  // validation is done when kernel starts the initialisation process
  async validate(config: MyBundleConfig) {}

  // Gives you the chance to hook into kernel and bundle-level events.
  // Runs before KernelBeforeInitEvent
  async hook() {}

  // Here you can basically prepare for initialisation
  // And give other bundle's a chance to modify this bundle's behavior
  async prepare() {}

  // runs the initialisation part, binds services, register application-level listeners, creates event loops, etc
  async init() {}
}
```

When we do `kernel.init()`, the following things happen:

1. We inject the `kernel` via `setKernel()` inside the Bundle instance
2. We await validation from all bundles
3. We start the hooking phase
4. We await preparation from all bundles
5. We await initialisation from all bundles

Kernel also emits the following events (name descriptive enough), and listeners are run in-sync:

- KernelBeforeInitEvent
- BundleBeforePrepareEvent
- BundleAfterPrepareEvent
- BundleBeforeInitEvent
- BundleAfterInitEvent
- KernelAfterInitEvent

So, in theory you have the chance to hook even more to the bundles you love:

```typescript
import {
  Bundle,
  Events,
  EventManager,
  Event,
  BundleAfterPrepareEvent,
} from "@kaviar/core";

class MyBundle extends Bundle {
  hook() {
    // Let's say you want to do stuff, after MyOtherBundle gets prepared
    const manager = this.get<EventManager>(EventManager);

    manager.addListener(
      BundleAfterPrepareEvent,
      async (e: BundleAfterPrepareEvent) => {
        if (e.data.bundle instanceof MyOtherBundle) {
          // Do stuff
        }
      }
    );
  }
}
```

Let's say we have a bundle that needs an API key, for example, `MailBundle` needs some authentication parameters. The way we connect Bundle's config to the container is by setting some constants into the container which the services use in their instantiation. Please do not use strings as strings may collide, rely on symbols.

```typescript
import { Inject, Service, Bundle } from "@kaviar/core";

const Constants = {
  API_KEY: Symbol(),
};

@Service()
class MailService {
  @Inject(() => Constants.API_KEY)
  protected apiKey;

  send() {}
}

type MailBundleConfigType = {
  apiKey: string;
};

class MailBundle extends Bundle<MailBundleConfigType> {
  async prepare() {
    // note that this suited for the preparation phase
    // while you can easily do it in init() this can give a chance to other bundles
    // to hack this bundle's behavior after it has been prepared
    this.container.set(Constants.API_KEY, this.config.apiKey);
  }
}
```

You can also inject it via constructor, as well:

```typescript
import { Inject } from "@kaviar/core";

class MailService {
  constructor(@Inject(Constants.API_KEY) protected apiKey: string) {}
}
```

## Listening to Events

The way we listen to events, we have to register them somehow. This is why we introduce the concept of "warmup" for listeners.

```typescript
import { Listener } from "@kaviar/core";

class NotificationListener extends Listener {
  init() {
    // Note that listeners do have access to the full container via this.get()
    // They are proxies, they should not contain logic

    this.on(UserAddedEvent, (event: UserAddedEvent) => {
      const notificationService = this.get<NotificationService>(
        NotificationService
      );
      const { userId } = event.data;

      notificationService.createNewUserNotification(userId);
    });
  }
}
```

```typescript
class AppBundle extends Bundle {
  async init() {
    // Warmup accepts services that expose a init() function with no arguments
    // It automatically registers them into the container
    await this.warmup([NotificationListener]);
  }
}
```

## Hacking Bundles

Keep your bundle hackable, by allowing injection of customised services. The strategy is to use an `abstract class` as a placeholder.

**When would you like to do this?**
This would be suited when you expose a bundle in which you allow a certain service to be overriden.

```typescript
abstract class HashService {
  hash(str: string) {
    return str; // safest hasher in the world.
  }
}

// a placeholder, or declare hash abstract and implement it here, your choice or a mixture of both depending on the use-case
class DefaultHashService extends HashService {}

class SecurityBundle extends Bundle<{hasher?: HashService}> {
  static defaultConfig = {
    hasher: DefaultHashService,
  };

  prepare() {
    // Now that I've bound HashService
    this.container.set(HashService, this.config.hasher);
  }
}

// adding it when you instantiate the bundle
kernel.addBundle(
  new SecurityBundle({
    hasher: ExtendedHashService,
  })
);

kernel.container.get(HashService), // ExtendedHashService
```

This strategy is to explicitly state which hasher you want in the constructor, but in real-life scenarios, you'll most likely do this inside your own `Application Bundle`

You have 2 ways, alter the configuration of SecurityBundle:

```typescript
class SecurityExtensionBundle extends Bundle {
  async hook() {
    const manager = this.get<EventManager>(EventManager);

    manager.on(BundleBeforePrepareEvent, (e: BundleBeforePrepareEvent) => {
      const { bundle } = e.data;
      if (bundle instanceof SecurityBundle) {
        bundle.updateConfig({
          hasher: MyExtendedHasher,
        });
      }
    });
  }
}
```

This strategy may feel a bit obscure as you allow any bundle to modify the config at any stage, if you want to prevent such things happening to your **precious** bundle, you can do something like:

```typescript
class SecurityBundle extends Bundle {
  updateConfig() {
    throw new Error(
      `Please use the exposed methods of this bundle to override config.`
    );
  }

  setHasher(hasher: HashService): void {
    Object.assign(this.config, { hasher });
  }
}

class SecurityExtensionBundle extends Bundle {
  async hook() {
    const manager = this.get<EventManager>(EventManager);

    manager.on(BundleBeforePrepareEvent, (e: BundleBeforePrepareEvent) => {
      const { bundle } = e.data;
      if (bundle instanceof SecurityBundle) {
        bundle.setHasher(MyExtendedHasher);
      }
    });
  }
}
```

## Conclusion

Designing large-systems is hard, code tends to rot in time, you have to adopt an infinitely-scalable approach. This is just a small framework, it's not enough to use it in order to use it properly.

Just describing what sounds an orchestra can make doesn't mean you can make music, it is now up to you to use this ecosystem and enlarge it.
