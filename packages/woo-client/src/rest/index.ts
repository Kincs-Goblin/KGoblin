import "server-only";

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
