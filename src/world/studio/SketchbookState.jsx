import { createContext, useContext, useRef } from "react";

// Unfinished ink survives moving between private pages. Only the explicit
// Keep/Save action persists it; leaving the private world releases these drafts.
const SketchbookContext = createContext(null);
export function SketchbookProvider({ children }) {
  const pages = useRef({});
  return (
    <SketchbookContext.Provider value={pages}>
      {children}
    </SketchbookContext.Provider>
  );
}
export const useSketchPages = () => useContext(SketchbookContext);
