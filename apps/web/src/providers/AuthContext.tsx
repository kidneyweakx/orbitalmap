import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { usePrivy, User } from '@privy-io/react-auth';

// Define the shape of the authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: () => void;
  logout: () => void;
  setIsAuthenticated: (value: boolean) => void;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component that wraps the application and provides authentication state
export function AuthProvider({ children }: AuthProviderProps) {
  const { 
    authenticated: privyAuthenticated, 
    ready: isReady, 
    user, 
    login, 
    logout 
  } = usePrivy();
  
  // Local state to allow manual override when needed
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Sync with Privy's authentication state
  useEffect(() => {
    if (isReady) {
      setIsAuthenticated(privyAuthenticated);
    }
  }, [privyAuthenticated, isReady]);

  // Value to be provided by the context
  const value: AuthContextType = {
    isAuthenticated,
    isLoading: !isReady, // When not ready, we're loading
    user,
    login,
    logout,
    setIsAuthenticated
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use the authentication context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 