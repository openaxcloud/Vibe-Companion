import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Frown } from 'lucide-react';

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4 text-center animate-fade-in">
      <Card className="max-w-md mx-auto p-8">
        <Frown className="h-24 w-24 text-slate-400 mx-auto mb-6" />
        <CardTitle className="text-5xl font-bold text-white mb-4">404</CardTitle>
        <CardDescription className="text-xl text-slate-400 mb-6">
          Oops! The page you're looking for doesn't exist.
        </CardDescription>
        <Link to="/">
          <Button variant="primary" size="lg">
            Go to Homepage
          </Button>
        </Link>
      </Card>
    </div>
  );
}

export default NotFoundPage;
