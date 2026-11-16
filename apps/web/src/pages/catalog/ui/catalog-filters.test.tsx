import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { CatalogFilterSidebar } from "./catalog-filters";

describe("CatalogFilterSidebar", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("100-zal nem osztható árszűrő értékkel is elküldhető gépelés után", async () => {
    const user = userEvent.setup();

    render(
      <CatalogFilterSidebar
        basePath="/termekek"
        activeCategory={null}
        categories={[]}
        attributes={[]}
        query={{
          sort: "ajanlott",
          onSale: false,
          inStockOnly: false,
          attributes: [],
          page: 1,
        }}
        currencyUnit="EUR"
      />,
    );

    const minInput = screen.getByLabelText("Minimum ár (EUR)");
    const maxInput = screen.getByLabelText("Maximum ár (EUR)");
    expect(minInput).toHaveAttribute("step", "1");
    expect(maxInput).toHaveAttribute("step", "1");

    await user.type(minInput, "15990");
    await user.type(maxInput, "45990");
    await user.click(screen.getByRole("button", { name: "Szűrés" }));

    expect(pushMock).toHaveBeenCalledWith("/termekek?min=15990&max=45990", { scroll: false });
  });
});
