A powerful and lightweight module composition strategy responsible for orchestrating your logic, enabling you to easily respect SOLID principles within your infinitely scalable app.

## Install

```bash
npm install --save @kaviar/core
```

## Basic Setup

When dealing with a small or large scale applications, you usually have groups of logic that need to be separated in order for them to be re-usable. For example you have a module for handling api requests, one for communicating with the database, one for sending emails, you get the idea.

These modules need to be able to have an initialisation phase and provide a way for other modules to depend on them and even extend them.

All modules are grouped inside the `Kernel` and we call them `bundles`. A bundle is a group of logic that is re-usable.

```typescript
import { Kernel } from "@kaviar/core";
const kernel = new Kernel();

kernel.init().then(() => {
  console.log("Kernel has been initialised.");
});
```

The Kernel is nothing without bundles. Bundles contain the logic.

```typescript
import { Bundle } from "@kaviar/core";

class AppBundle extends Bundle {
  async init() {
    // This is invoked when kernel is initialised
    console.log("I have been initialised");
  }
}
```

You can add the bundle to the `kernel` in the constructor or later on:

```typescript
const kernel = new Kernel({
  bundles: [new AppBundle()],
});

// Add bundles outside constructor
kernel.addBundle(new OtherBundle());

kernel.init().then(() => {
  // At this stage all the bundles `init()` function have been called.
});
```

Initialisation process prepares and initialiases all the bundles registered inside it. You can regard your `Bundles` as groups of independent logic or strongly separated concerns.

## Dependency Injection

This design pattern solves the problem with modifying or extending logic of other bundles.

As `kernel` contains a group `bundles`. A `container` contains references to instances, strings (passwords, api keys), etc.

An oversimplification of D.I. is that you don't depend on "real" implementations, you depend on references (strings, classes, tokens). For example, let's say you have a container that contains everything you need in your app, connection to the database, credentials, anything. And let's say you want to access the database service to do an insert, so instead of getting the service directly (by `new Service()`-ing it, or accessing the singleton `Service.doSomething()`), you use the container:

```ts
import { Service } from "@kaviar/core";

@Service()
class MyDatabaseService {
  insertUser() {
    // Do something
  }
}

// You can get the container from `kernel.container`
container.set({
  id: "database_service",
  type: MyDatabaseService,
});

// Note that it will instantiate the class you have set
const databaseService = container.get("database_service");
databaseService.insertUser({
  name: "Elon Musk",
});
```

Now let's say the `databaseService` needs some credentials and a host to connect to. So instead of using a string directly or reading directly from env, it reads it from container:

```ts
import { Service } from "@kaviar/core";

@Service()
class MyDatabaseService {
  constructor(@Inject("database_uri") databaseUri) {
    // Just a sample for illustration
    this.client = mongodb.connect(databaseUri);
  }
}
```

Now when we `.get()` MyDatabaseService from the `container`, it will automatically inject the dependencies.

In conclusion, we never instantiate via `new` we only fetch instances of our services through the container, and there's only one container which is provided by the `Kernel` (accessible via `kernel.container` or `this.container` inside `Bundle` methods). Above we showed how to use references as strings (`database_uri`, `database_service`) but references can be classes or tokens.

We recommend that you use tokens or classes and avoid strings, they have been shown here to illustrate the idea.

### Services

We regard as a `Service` a class that executes logic.

```typescript
import { Service } from "@kaviar/core";

const container = kernel.container;

@Service()
class B {}

@Service()
class A {
  // Automatic injection, you don't need to specify @Inject()
  constructor(b: B) {
    this.b = b;
  }
}
```

Now let's use them:

```typescript
const a = container.get(A); // note, A is the className, a is the instance
(instanceof a.b) === B; // true, a.b is an instance of B
```

Services are singletons, meaning it instantiates only once:

```typescript
const a = container.get(A);
a === container.get(A); // true
```

### Tokens

If you want to avoid having strings collide, you should use tokens as references:

```ts
import { Inject, Token } from "@kaviar/core";

class B {}

// We specify the type of the token to offer us autocompletion
const MY_SERVICE_TOKEN = new Token<B>();

container.set(MY_SERVICE_TOKEN, B); // A simple B class
container.get(MY_SERVICE_TOKEN); // this is a singleton B instance

class A {
  // Note: property injection will be set after constructor
  @Inject(MY_SERVICE_TOKEN)
  b: B;

  // OR

  constructor(@Inject(MY_SERVICE_TOKEN) b: B) {
    // Both solutions work well (property injection/constructor injection)
    // Just do what you feel is easier
  }
}
```

## Async Event Management

This technique allows us to have typesafety for Event Management, and event handlers can be async and can be blocking for the event propagation.

```typescript
import { EventManager, Event } from "@kaviar/core";

class UserCreatedEvent extends Event<{
  // This is what information you need to pass when creating the event
  // It can be omitted if events don't store any data
  userId: string;
}> {}

const manager = container.get(EventManager);

manager.addListener(UserCreatedEvent, e => {
  // The data provided in event's constructor is found in event.data property
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
  async e => {
    // Do something before any other handler executes
  },
  {
    order: -1000, // the lowest get executed first, by default order = 0
  }
);
```

You can also add a filter to the option, that will only allow certain "instances" of events. Let's say everytime you insert an object into the database you emit an event that contains also the collectionName in it. And you would like to listen to events for a certain collection:

```typescript
class ObjectInsertedEvent extends Event<{
  collectionName: string;
}> {}

manager.addListener(
  ObjectInsertedEvent,
  async e => {
    // Do something when the event
  },
  {
    filter: e => e.data.collectionName === "users",
  }
);
```

This is just a shorthand function so it allows your handler to focus on the task at hand rather than conditioning execution.

### Listeners

In order to listen to events we have to register them somehow. This is why we introduce the concept of "warmup" for listeners.

```typescript
import { Listener, On } from "@kaviar/core";

// The base Listener class has a init() function that registers the events accordingly
class NotificationListener extends Listener {
  @On(UserAddedEvent, {
    /* order, filter */
  })
  onUserAdded(e: UserAddedEvent) {
    // Do something
  }
}
```

All listeners must be warmed up for them to work.

## Warming Up

Warming up instantiates the specific Service, and if the `init()` function exists it will be called.
For example, you might use this for a DatabaseConnection, you want to immediately connect and you implement this in the service's `init()` function.

```typescript
class AppBundle extends Bundle {
  async init() {
    await this.warmup([NotificationListener]);
  }
}
```

## Bundles

Ok, now that you've learned the basics of containers and async event management, it's time to understand where all logic lies (inside the bundles and their services)

### Configuration

Bundles can have a specific configuration to them and this is passed when instantiating them:

```ts
import { Bundle } from "@kaviar/core";

type SaaSConfigType = {
  subscriptionFee: number;
  currency: string;
};

class SaaSBundle extends Bundle<SaaSConfigType> {
  async init() {
    // You have access to the configuration in here: this.config
  }
}

// You pass the config inside the bundle's constructor
kernel.addBundle(
  new SaaSBundle({
    subscriptionFee: 100,
    currency: "USD",
  })
);
```

You can also specify a default configuration for your bundle. The config you pass when constructing the bundle gets merged deeply with `defaultConfig`.

```ts
class SaaSBundle extends Bundle<Config> {
  defaultConfig = {
    currency: "USD",
  };
}
```

Another feature regarding configuration is providing a required config. A config that you must always pass:

```ts
type RequiredConfig = {
  subscriptionFee: number;
};

class SaaSBundle extends Bundle<Config, RequiredConfig> {}

new SaaSBundle({
  // Must be provided
  subscriptionFee: 100,
});
```

We decided to make this split because we want developers to force a specific value for a bundle that wouldn't be feasible to have it in `defaultConfig`.

You can also have more complex validation logic via `validate()`:

```ts
class SaaSBundle extends Bundle<Config, RequiredConfig> {
  async validate(config) {
    // Ensure that the provided config is ok
    // Throw an exception if it's not ok.
  }
}
```

### Lifecycle

Right now you've seen that bundles get initialised via the `init()` async function. But there's more to it because we wanted to allow bundles to work together and extend each other.

```typescript
class MyBundle extends Bundle<MyBundleConfig> {
  // This runs first and you can hook to bundle events
  // For example (before or after a specific bundle initialises)
  async hook() {}

  // Here you can basically prepare for initialisation, for example registering listeners, etc
  // You can regard this as container-preparation phase.
  async prepare() {}

  // The final step in the bundle's lifecycle. This is where bundles usually start event loops (you start express), or connect to the database
  async init() {}
}
```

Kernel also emits the following events (name descriptive enough), and listeners are run in-sync:

- KernelBeforeInitEvent
- BundleBeforePrepareEvent
- BundleAfterPrepareEvent
- BundleBeforeInitEvent
- BundleAfterInitEvent
- KernelAfterInitEvent

### Hooking

So, in theory you have the chance to hook even more to the bundles you love:

```ts
import {
  Bundle,
  Events,
  EventManager,
  Event,
  BundleAfterPrepareEvent,
} from "@kaviar/core";

class MyBundle extends Bundle {
  hook() {
    // Let's say you want to do stuff, after MyOtherBundle gets prepared.
    const manager = this.container.get(EventManager);

    manager.addListener(
      BundleAfterPrepareEvent,
      async e => {
        // Do something
      },
      // Optional filter
      {
        filter: e => e.data.bundle instanceof MyOtherBundle,
      }
    );
  }
}
```

### Credentials and Keys

Let's say we have a bundle that needs an API key, for example, `MailBundle` needs some authentication parameters. The way we connect Bundle's config to the container is by setting some constants into the container which the services use in their instantiation.

```typescript
import { Inject, Service, Token, Bundle } from "@kaviar/core";

// {bundle}/constants.ts
const Constants = {
  API_KEY: new Token<string>(),
};

// {bundle}/services/MailService.ts
@Service()
class MailService {
  constructor(@Inject(Constants.API_KEY) protected readonly apiKey: string) {}

  send() {
    // access this.apiKey
  }
}

// {bundle}/{bundle}.ts
interface IMailBundleConfig {
  apiKey: string;
}

class MailBundle extends Bundle<IMailBundleConfig> {
  async prepare() {
    // We do this in prepare() phase
    this.container.set(Constants.API_KEY, this.config.apiKey);
  }
}
```

## Exceptions

It's nice to never rely on string matching to see which exception was thrown, and it's nice to have typesafety as well. We recommend you always use this instead of the standard `Error`. The reason we changed the name to `Exception` instead of Error was to avoid confusion that these class would somehow extend the `Error` class.

```typescript
import { Exception } from "@kaviar/core";

class UserNotAuthorizedException extends Exception<{
  userId: string;
  context: string;
}> {
  // optional specify a code for easy search
  // please note that if you do this, you have to manage it properly
  static code = "K10581";

  getMessage() {
    const { userId, context } = this.data;

    return `User with id ${userId} was denied access while trying to access: ${context}`;
  }
}

throw new UserNotAuthorizedException({
  userId: "123",
  context: "viewUserProfile",
});
```

```typescript
try {
  viewUserProfile(profileId, { userId });
} catch (e) {
  if (e instanceof UserNotAuthorizedException) {
    // Do something
    // You can access: e.message to see the compiled message + optionally prefixed with the code
  }
}
```

## Kernel Parameters

You can also specify a list of parameters to the kernel. When the bundles within your app need the same information, you should use this instead of passing it as a config to each bundle.

```js
new Kernel({
  parameters: {
    // Just some examples, they can be anything
    applicationUrl: "https://www.google.com/",
    debug: true,
  },
});

// Fetching them is getting the string wrapped in %%
const applicationUrl = container.get("%applicationUrl%");

// Or you can get them via kernel.parameters
```

You can inject parameters from kernel, or others like this:

```typescript
@Service()
class A {
  // Inject via property, Note: it uses a function
  @Inject(() => "%debug%")
  protected isDebug: boolean;

  // Inject via constructor
  constructor(@Inject("%applicationUrl%") applicationUrl: string) {
    // Do something based on the context
  }
}
```

To benefit of autocompletion for your kernel parameters:

```ts title="defs.ts"
import "@kaviar/core";

declare module "@kaviar/core" {
  export interface IKernelParameters {
    applicationUrl: string;
  }
}
```

By default the available parameters are:

```ts
export interface IKernelParameters {
  debug: boolean; // Whether you are using in debug mode
  testing: boolean; // Whether you are using the kernel to run tests
  context: KernelContext;
}

export enum KernelContext {
  DEVELOPMENT = "development",
  PRE_PRODUCTION = "pre-production",
  PRODUCTION = "production",
}
```

## Advanced Bundles

Keep your bundle easily modifiable by allowing injection of customised services. The strategy is to use an `abstract class` as a placeholder, but there are other solutions as well.

:::note When would you like to do this?
This would be suited when you expose a bundle in which you allow a certain service to be overriden.
:::

Let's think of a bundle that does some security thingies and they want to allow you to inject a custom hash function.

```typescript
abstract class HashService {
  hash(str: string) {
    return md5(str);
  }
}

// a placeholder, or declare hash abstract and implement it here, your choice or a mixture of both depending on the use-case
class DefaultHashService extends HashService {}

class SecurityBundle extends Bundle<{ hasher: HashService }> {
  static defaultConfig = {
    hasher: DefaultHashService,
  };

  prepare() {
    // We bind HashService, to use a different constructor
    this.container.set({ id: HashService, type: this.config.hasher });
  }
}

// adding it when you instantiate the bundle
kernel.addBundle(
  new SecurityBundle({
    hasher: ExtendedHashService,
  })
  // Now every service that depends on HashService will be overriden
);
```

This strategy is to explicitly state which hasher you want in the constructor, but in real-life scenarios, you'll most likely do this inside your own `AppBundle`:

```typescript
class SecurityExtensionBundle extends Bundle {
  async hook() {
    const manager = this.container.get(EventManager);

    // Before SecurityBundle is prepared, I can either modify the config
    manager.addListener(
      BundleBeforePrepareEvent,
      e => {
        const { bundle } = e.data;

        // We use the `updateConfig` command
        bundle.updateConfig({
          hasher: MyExtendedHasher,
        });
      },
      {
        filter: e => e.data.bundle instanceof SecurityBundle,
      }
    );
  }
}
```

This strategy may feel a bit obscure as you allow any bundle to modify the config at any stage, if you want to prevent such things happening to your bundle, you can do something like:

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

// And now you call setHasher instead of updateConfig.
```

:::info
If you want to have more control over the `setHasher` you can use `bundle.phase` to ensure that it is set within the preparation or initialisation phase.
:::

```ts title="Phases for bundles and kernel"
export enum KernelPhase {
  DORMANT = "dormant",
  BUNDLE_SETUP = "bundle-setup",
  HOOKING = "hooking",
  PREPARING = "preparing",
  INITIALISING = "initialising",
  INITIALISED = "initialised",
  FROZEN = INITIALISED,
}

export enum BundlePhase {
  DORMANT = "dormant",
  SETUP = "setup",
  HOOKING = "hooking",
  HOOKED = "hooked",
  BEFORE_PREPARATION = "preparing",
  PREPARED = "prepared",
  BEFORE_INITIALISATION = "initialising",
  INITIALISED = "initialised",
  FROZEN = INITIALISED,
}
```

## Testing

We recommend using [jest](https://jestjs.io/) for testing. The idea here is that when you have a `kernel` with multiple bundles, sometimes your bundles might behave differently, this is why we have a kernel parameter called `testing`.

```ts
const kernel = new Kernel({
  bundles: [],
  parameters: {
    testing: true,
  },
});
```

When testing the full kernel you need to have an ecosystem creation function. We recommend having a separate `kernel.test.ts` file where you instantiate the kernel.

```ts title="ecosystem.ts"
import { kernel } from "../startup/kernel.test";

const container = kernel.container;

export { container, kernel };

export async function createEcosystem() {
  await kernel.init();
}

beforeAll(async () => {
  return createEcosystem();
});

afterAll(async () => {
  // This will call shutdown() on all bundles
  // This is useful when you want to stop db connections or server loops
  await kernel.shutdown();
});
```

Ensure that the code above is loaded before all tests. Now you would be able to run your tests:

```ts
import { container } from "../ecosystem";

describe("PostService", () => {
  test("approvePost", () => {
    const postService = container.get(PostService);
    // Now you have full access to container and the bundles and other services to provide an integration test
  });
});
```

## Conclusion

These set of tools: the `kernel`, the `container`, the `bundles` (extendable & hackable), the async event management, the type-safe exceptions allow us to construct high-quality applications which respect the SOLID principles and can be nicely re-used. A good example of how this is put to good use is inside the `X-Framework`.
