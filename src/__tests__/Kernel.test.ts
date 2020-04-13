import { Bundle } from "../lib/Bundle";
import { assert, expect } from "chai";
import { Kernel } from "../lib/Kernel";

describe("Kernel", () => {
  it("Should be instantiable with bundles, parameters, and can addBundles", async () => {
    class A extends Bundle {}
    class B extends Bundle {}

    const kernel = new Kernel({
      bundles: [new A()],
      parameters: {
        config: "100",
      },
    });

    kernel.addBundle(new B());

    await kernel.init();

    assert.isTrue(kernel.hasBundle(B));
    assert.isNotNull(kernel.get(B));
    assert.isNotNull(kernel.get(A));

    assert.isTrue(kernel.parameters.config === "100");
  });

  it("Should not allow me to add a bundle after it was initialised", async () => {
    const kernel = new Kernel();
    class B extends Bundle {}

    await kernel.init();

    expect(() => {
      kernel.addBundle(new B());
    }).to.throw();
  });

  it("Should not allow me to add the same bundle twice", async () => {
    const kernel = new Kernel();
    class B extends Bundle {}
    kernel.addBundle(new B());
    expect(() => {
      kernel.addBundle(new B());
    }).to.throw();

    await kernel.init();
  });
});
