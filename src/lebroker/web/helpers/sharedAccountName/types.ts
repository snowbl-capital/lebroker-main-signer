import type { SharedAccountView } from "../../types"

type SharedAccountNameProps = { account: Pick<SharedAccountView, "name" | "ownerAddress"> }

export type { SharedAccountNameProps }
