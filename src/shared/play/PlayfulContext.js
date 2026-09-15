import { createContext, useContext } from "react";

export const PlayContext = createContext({ moving: true });
export const usePlayful = () => useContext(PlayContext);
