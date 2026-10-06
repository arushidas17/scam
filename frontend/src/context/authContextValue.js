import { createContext } from 'react'

/** Lives apart from the provider so both files export only one kind of thing. */
export const AuthContext = createContext(null)
