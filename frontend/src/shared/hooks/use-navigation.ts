import { useContext } from "react";

import { NavigationContext } from "../../app/providers/navigation-provider";

export function useNavigation() {
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }

  return context;
}
