import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface RuntimeDependencies {
  docker: {
    available: boolean;
    version?: string;
    error?: string;
  };
  nix: {
    available: boolean;
    version?: string;
    error?: string;
  };
  languages: Record<string, {
    available: boolean;
    version?: string;
    error?: string;
  }>;
}

export default function RuntimeTest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dependencies, setDependencies] = useState<RuntimeDependencies | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDependencies = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching runtime dependencies...');
      const response = await fetch('/api/runtime/dependencies');
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Dependencies data:', data);
      setDependencies(data);
      
      toast({
        title: "Success",
        description: "Runtime dependencies fetched successfully.",
      });
    } catch (err) {
      console.error('Error fetching dependencies:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to fetch dependencies',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Auto-fetch on component mount
  useEffect(() => {
    fetchDependencies();
  }, []);

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Runtime Dependencies Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Runtime Dependencies Endpoint</CardTitle>
          <CardDescription>
            Test the public endpoint for runtime dependencies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            This page tests the public endpoint for runtime dependencies.
            Click the button below to fetch the dependencies.
          </p>
          
          <Button 
            onClick={fetchDependencies} 
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fetch Dependencies
          </Button>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start">
          {dependencies && (
            <div className="w-full">
              <h3 className="text-lg font-medium mb-2">Docker:</h3>
              <div className="mb-4 p-2 bg-gray-50 rounded-md">
                <p>Available: {dependencies.docker.available ? "Yes" : "No"}</p>
                {dependencies.docker.version && <p>Version: {dependencies.docker.version}</p>}
                {dependencies.docker.error && <p className="text-red-500">Error: {dependencies.docker.error}</p>}
              </div>
              
              <h3 className="text-lg font-medium mb-2">Nix:</h3>
              <div className="mb-4 p-2 bg-gray-50 rounded-md">
                <p>Available: {dependencies.nix.available ? "Yes" : "No"}</p>
                {dependencies.nix.version && <p>Version: {dependencies.nix.version}</p>}
                {dependencies.nix.error && <p className="text-red-500">Error: {dependencies.nix.error}</p>}
              </div>
              
              <h3 className="text-lg font-medium mb-2">Languages:</h3>
              {Object.entries(dependencies.languages).map(([lang, info]) => (
                <div key={lang} className="mb-2 p-2 bg-gray-50 rounded-md">
                  <p className="font-medium">{lang}:</p>
                  <p>Available: {info.available ? "Yes" : "No"}</p>
                  {info.version && <p>Version: {info.version}</p>}
                  {info.error && <p className="text-red-500">Error: {info.error}</p>}
                </div>
              ))}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}