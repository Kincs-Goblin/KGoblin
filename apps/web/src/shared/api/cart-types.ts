import type { MoneyParts } from "../lib/format";

export type CartItemVariationDto = {
  attribute: string;
  value: string;
};

export type CartItemDto = {
  key: string;
  productId: number;
  quantity: number;
  name: string;
  slug: string;
  sku: string;
  image: { src: string; alt: string } | null;
  variation: CartItemVariationDto[];
  unitPrice: MoneyParts;
  regularPrice: MoneyParts;
  lineSubtotal: MoneyParts;
  lineTotal: MoneyParts;
};

export type CartCouponDto = {
  code: string;
  discountType: string;
  totalDiscount: MoneyParts;
};

export type CartShippingRateDto = {
  rateId: string;
  name: string;
  description: string;
  deliveryTime: string;
  price: MoneyParts;
  methodId: string;
  selected: boolean;
};

export type CartShippingPackageDto = {
  packageId: number;
  name: string;
  rates: CartShippingRateDto[];
};

export type CartShippingAddressDto = {
  country: string;
  postcode: string;
  city: string;
};

export type CartTotalsDto = {
  items: MoneyParts;
  discount: MoneyParts;
  shipping: MoneyParts | null;
  tax: MoneyParts;
  total: MoneyParts;
};

export type CartFreeShippingProgressDto = {
  threshold: MoneyParts;
  remaining: MoneyParts;
  eligible: boolean;
  progressPercent: number;
};

export type CartDto = {
  items: CartItemDto[];
  coupons: CartCouponDto[];
  shippingPackages: CartShippingPackageDto[];
  shippingAddress: CartShippingAddressDto;
  totals: CartTotalsDto;
  itemsCount: number;
  needsShipping: boolean;
  needsPayment: boolean;
  freeShippingProgress: CartFreeShippingProgressDto | null;
};

export const EMPTY_CART_DTO: CartDto = {
  items: [],
  coupons: [],
  shippingPackages: [],
  shippingAddress: { country: "HU", postcode: "", city: "" },
  totals: {
    items: { amount: "0", currency: "HUF", minorUnit: 0 },
    discount: { amount: "0", currency: "HUF", minorUnit: 0 },
    shipping: null,
    tax: { amount: "0", currency: "HUF", minorUnit: 0 },
    total: { amount: "0", currency: "HUF", minorUnit: 0 },
  },
  itemsCount: 0,
  needsShipping: false,
  needsPayment: false,
  freeShippingProgress: null,
};
