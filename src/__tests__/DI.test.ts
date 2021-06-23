import { Bundle } from "../models/Bundle";
import { assert } from "chai";
import { Kernel } from "../models/Kernel";
import { EventManager } from "../models/EventManager";
import { BundlePhase } from "../defs";
import { Inject, Service } from "typedi";

describe("DI", () => {
  it("Should work without specifying @Service()", async () => {
    class DatabaseService {
      insertsUser(name: string) {
        return {
          id: 1,
          name,
        };
      }
    }

    @Service()
    class SecurityService {
      constructor(public readonly databaseService: DatabaseService) {}

      createUser(name: string) {}
    }

    class MySecurityService extends SecurityService {
      @Inject()
      mydb: DatabaseService;

      constructor(public readonly databaseService: DatabaseService) {
        super(databaseService);
      }
    }

    class AppBundle extends Bundle {
      async init() {}
    }

    const kernel = new Kernel({
      bundles: [new AppBundle()],
    });

    await kernel.init();

    const securityService = kernel.container.get(MySecurityService);
    expect(securityService.databaseService).toBeInstanceOf(DatabaseService);
    securityService.createUser("Hello");
  });
});
