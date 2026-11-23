"use client";

import { MapPinIcon, TruckIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useCart } from "@/entities/cart";
import { formatMoney } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { selectShippingTexts } from "../config/texts";
import { FreeShippingBanner } from "./free-shipping-banner";

export function ShippingSelector({ locale }: { locale?: string } = {}) {
  const { cart, selectShippingRate, updateShippingAddress } = useCart();
  const [country, setCountry] = useState(cart.shippingAddress.country || "HU");
  const [postcode, setPostcode] = useState(cart.shippingAddress.postcode || "");
  const [syncedAddress, setSyncedAddress] = useState(
    `${cart.shippingAddress.country}|${cart.shippingAddress.postcode}`,
  );
  const [addressError, setAddressError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [selectingRateId, setSelectingRateId] = useState<string | null>(null);

  const serverAddressKey = `${cart.shippingAddress.country}|${cart.shippingAddress.postcode}`;
  if (serverAddressKey !== syncedAddress) {
    setSyncedAddress(serverAddressKey);
    setCountry(cart.shippingAddress.country || "HU");
    setPostcode(cart.shippingAddress.postcode || "");
  }

  const countryId = useId();
  const postcodeId = useId();
  const errorId = useId();

  async function handleCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (calculating) return;
    const trimmed = postcode.trim();
    if (trimmed.length < 2) {
      setAddressError(selectShippingTexts.postcodeError);
      return;
    }

    setAddressError(null);
    setCalculating(true);
    const result = await updateShippingAddress({ country, postcode: trimmed });
    setCalculating(false);

    if (result.ok) {
      toast.success(selectShippingTexts.postcodeUpdated);
    } else {
      setAddressError(result.message);
    }
  }

  async function handleSelectRate(packageId: number, rateId: string) {
    if (selectingRateId !== null) return;
    setSelectingRateId(rateId);
    await selectShippingRate(rateId, packageId);
    setSelectingRateId(null);
  }

  const allPackages = cart.shippingPackages;
  const selectedRate = allPackages.flatMap((pkg) => pkg.rates).find((rate) => rate.selected);
  const isPickupSelected = selectedRate?.methodId === "local_pickup";

  return (
    <section className="surface-wood rounded-xl border border-bronze/40 p-4">
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
        <TruckIcon className="size-4 text-gold" aria-hidden="true" />
        {selectShippingTexts.heading}
      </h2>

      <FreeShippingBanner locale={locale} className="mt-3" />

      <form
        onSubmit={handleCalculate}
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        noValidate
      >
        <div>
          <label htmlFor={countryId} className="mb-1 block text-xs text-muted-foreground">
            {selectShippingTexts.countryLabel}
          </label>
          <select
            id={countryId}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            disabled={calculating}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            {selectShippingTexts.countries.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={postcodeId} className="mb-1 block text-xs text-muted-foreground">
            {selectShippingTexts.postcodeLabel}
          </label>
          <Input
            id={postcodeId}
            name="postcode"
            type="text"
            inputMode="numeric"
            value={postcode}
            onChange={(event) => {
              setPostcode(event.target.value);
              if (addressError) setAddressError(null);
            }}
            placeholder={selectShippingTexts.postcodePlaceholder}
            aria-invalid={addressError ? true : undefined}
            aria-describedby={addressError ? errorId : undefined}
            disabled={calculating}
            className="h-10"
          />
        </div>

        <div className="flex items-end">
          <Button
            type="submit"
            variant="outline"
            disabled={calculating}
            className="h-10 w-full sm:w-auto"
          >
            {calculating ? selectShippingTexts.calculating : selectShippingTexts.calculate}
          </Button>
        </div>
      </form>

      {addressError ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {addressError}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {allPackages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{selectShippingTexts.noRates}</p>
        ) : (
          allPackages.map((pkg) => (
            <fieldset key={pkg.packageId} className="space-y-2">
              <legend className="sr-only">{pkg.name}</legend>
              {pkg.rates.map((rate) => {
                const isFree = rate.price.amount === "0";
                const isPending = selectingRateId === rate.rateId;
                const isChecked =
                  selectingRateId !== null ? selectingRateId === rate.rateId : rate.selected;
                return (
                  <label
                    key={rate.rateId}
                    className={cn(
                      "flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-colors",
                      isChecked
                        ? "border-gold bg-gold/10"
                        : "border-bronze/40 hover:border-gold/60",
                      isPending && "opacity-70",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name={`shipping-package-${pkg.packageId}`}
                        value={rate.rateId}
                        checked={isChecked}
                        disabled={selectingRateId !== null}
                        onChange={() => handleSelectRate(pkg.packageId, rate.rateId)}
                        className="mt-1 size-4 accent-gold"
                      />
                      <span className="flex flex-col">
                        <span className="font-heading text-sm font-semibold text-foreground">
                          {rate.name}
                        </span>
                        {rate.deliveryTime || rate.description ? (
                          <span className="text-xs text-muted-foreground">
                            {rate.deliveryTime || rate.description}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="shrink-0 font-heading text-sm font-semibold text-gold tabular-nums">
                      {isFree ? selectShippingTexts.freeLabel : formatMoney(rate.price, locale)}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))
        )}
      </div>

      {isPickupSelected ? (
        <div
          data-testid="pickup-point-slot"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-dashed border-bronze/60 bg-surface-wood-dark/40 p-3 text-xs text-muted-foreground"
        >
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">{selectShippingTexts.pickupSlotHeading}</p>
            <p className="mt-0.5">{selectShippingTexts.pickupSlotNote}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
