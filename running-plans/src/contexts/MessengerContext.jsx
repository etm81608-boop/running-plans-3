import { createContext, useContext, useState } from 'react'

const MessengerContext = createContext(null)

export function MessengerProvider({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <MessengerContext.Provider value={{ open, setOpen }}>
      {children}
    </MessengerContext.Provider>
  )
}

export function useMessenger() {
  return useContext(MessengerContext)
}
