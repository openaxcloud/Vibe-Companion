import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function FigmaImport() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate('/import?source=figma', { replace: true });
  }, [navigate]);

  return null;
}
