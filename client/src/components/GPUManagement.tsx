import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { XCircle } from 'lucide-react';

interface GPUManagementProps {
  projectId: number;
}

export function GPUManagement({ projectId }: GPUManagementProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-muted-foreground" />
          GPU Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTitle>Feature Removed</AlertTitle>
          <AlertDescription>
            GPU provider infrastructure has been removed. AI compute is now handled directly through integrated AI providers (OpenAI, Anthropic, Google, etc.) which offer better performance and reliability.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
