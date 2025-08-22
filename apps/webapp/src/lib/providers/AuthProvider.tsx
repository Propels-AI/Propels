import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  ReactNode,
} from "react";
import { Hub } from "@aws-amplify/core";
import { fetchUserAttributes, getCurrentUser, signOut } from "aws-amplify/auth";

interface AuthState {
  user: any | null;
  isLoading: boolean;
}

interface AuthAction {
  type: "SET_USER" | "SET_LOADING" | "RESET";
  user?: any | null;
  isLoading?: boolean;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.user || null, isLoading: false };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading ?? true };
    case "RESET":
      return initialState;
    default:
      return state;
  }
};

const AuthContext = createContext<
  | {
      state: AuthState;
      dispatch: React.Dispatch<AuthAction>;
    }
  | undefined
>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const checkAuthState = async () => {
      dispatch({ type: "SET_LOADING", isLoading: true });
      try {
        const user = await getCurrentUser();
        if (user) {
          const attributes = await fetchUserAttributes();
          dispatch({ type: "SET_USER", user: { ...user, attributes } });
        } else {
          dispatch({ type: "SET_USER", user: null });
        }
      } catch (error) {
        dispatch({ type: "SET_USER", user: null });
      }
    };
    checkAuthState();

    const hubListenerCancel = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
          checkAuthState();
          break;
        case "signedOut":
          dispatch({ type: "SET_USER", user: null });
          break;
        default:
          break;
      }
    });

    return () => {
      hubListenerCancel();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context.state;
}
