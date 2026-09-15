import { createContext, useContext, useRef } from "react";

// One shared doodle draft survives private navigation. Explicit Keep persists
// artwork; leaving the private world releases the unsaved drawing.
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
