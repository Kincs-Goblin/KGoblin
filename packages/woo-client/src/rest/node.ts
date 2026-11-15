/**
 * Node / Trigger.dev belépési pont (`@kg/woo-client/rest/node`), ahol nincs `react-server`
 * export-feltétel. Next.js alkalmazásból a `server-only`-val védett `@kg/woo-client/rest`-et használd!
 */
if (typeof document !== "undefined") {
  throw new Error("@kg/woo-client/rest/node csak szerveroldali Node-környezetben használható.");
}

export {
  createRestClient,
  createWooRestClient,
  type RestClient,
  type RestClientOptions,
  type RestListProductsQuery,
  type RestOrderUpdateInput,
  type RestProductBatchInput,
  type RestProductWriteInput,
  type WooRestClient,
  type WooRestClientOptions,
} from "./client";
export {
  restBatchErrorSchema,
  restBatchProductItemSchema,
  restMetaDataSchema,
  restOrderNoteSchema,
  restOrderSchema,
  restProductBatchResponseSchema,
  restProductListSchema,
  restProductSchema,
  type RestBatchError,
  type RestBatchProductItem,
  type RestMetaData,
  type RestOrder,
  type RestOrderNote,
  type RestProduct,
  type RestProductBatchResponse,
} from "./schemas";
