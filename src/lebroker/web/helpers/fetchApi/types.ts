import type { z } from "zod"
import type { ApiGetProps } from "../../../../api/types"
import type { ApiPath } from "../../enums"

/** A read of the web's API, its answer checked against its schema. */
type FetchApiProps<T> = { path: ApiPath; schema: z.ZodType<T> }

/** The signing wallet's session, as its reads take it: a read of the web's by its path, its answer unread. */
type ApiScope = { get: (props: ApiGetProps) => Promise<Response> }

/** `run` reads under the wallet's session `scope`. */
type WithApiScopeProps<T> = { scope: ApiScope; run: () => Promise<T> }

export type { ApiScope, FetchApiProps, WithApiScopeProps }
