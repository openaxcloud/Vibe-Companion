import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export function TestAuth() {
  const { user, isLoading, error, loginMutation, logoutMutation, registerMutation } = useAuth();
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('password');
  const [registering, setRegistering] = useState(false);

  const handleLogin = () => {
    loginMutation.mutate({ username, password });
  };

  const handleRegister = () => {
    registerMutation.mutate({ 
      username, 
      password,
      displayName: username
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Authentication Status</CardTitle>
        <CardDescription>
          {isLoading 
            ? 'Checking authentication status...' 
            : user 
              ? `Logged in as ${user.username}` 
              : 'Not logged in'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading...</span>
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="text-sm">
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Username:</strong> {user.username}</p>
              {user.email && <p><strong>Email:</strong> {user.email}</p>}
              {user.displayName && <p><strong>Display Name:</strong> {user.displayName}</p>}
            </div>
            <Button onClick={handleLogout} disabled={logoutMutation.isPending}>
              {logoutMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Logging out...
                </>
              ) : 'Logout'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="username" className="text-sm font-medium">Username</label>
                <Input 
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Input 
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={registering ? handleRegister : handleLogin} 
                disabled={loginMutation.isPending || registerMutation.isPending}
              >
                {(loginMutation.isPending || registerMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {registering ? 'Registering...' : 'Logging in...'}
                  </>
                ) : (registering ? 'Register' : 'Login')}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setRegistering(!registering)}
                disabled={loginMutation.isPending || registerMutation.isPending}
              >
                {registering ? 'Switch to Login' : 'Switch to Register'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        This component is for testing authentication during development.
      </CardFooter>
    </Card>
  );
}