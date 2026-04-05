import { useEffect, useState } from "react";
import Login from "@/pages/Login";
import { subscribeToAuthState } from "@/firebase/auth";

export default function App({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Checking authentication...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return children;
}
