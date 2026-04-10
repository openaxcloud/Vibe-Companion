import { useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  detectPackagesInCode, 
  detectMissingPackages,
  generateInstallCommand, 
  DetectedPackage,
  PACKAGE_PATTERNS,
  suggestPackageFromPattern
} from '@/lib/package-detector';
import { useToast } from '@/hooks/use-toast';

interface UsePackageDetectorOptions {
  showNotifications?: boolean;
  notificationDebounceMs?: number;
}

export function usePackageDetector(
  code: string, 
  installedPackages: string[],
  options: UsePackageDetectorOptions = {}
) {
  const { showNotifications = false, notificationDebounceMs = 2000 } = options;
  const { toast } = useToast();
  const notifiedPackagesRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const installedSet = useMemo(() => new Set(installedPackages), [installedPackages]);
  
  const { detectedPackages, missingPackages, missingPackageNames, installCommand } = useMemo(() => {
    const detected = detectPackagesInCode(code);
    const missing = detected.filter(pkg => !installedSet.has(pkg.name));
    const missingNames = detectMissingPackages(code, installedPackages);
    const command = missing.length > 0 
      ? generateInstallCommand(missing.map(p => p.name))
      : '';
    
    return {
      detectedPackages: detected,
      missingPackages: missing,
      missingPackageNames: missingNames,
      installCommand: command,
    };
  }, [code, installedSet, installedPackages]);

  const showMissingPackageNotification = useCallback((packages: string[]) => {
    if (packages.length === 0) return;
    
    const newPackages = packages.filter(pkg => !notifiedPackagesRef.current.has(pkg));
    if (newPackages.length === 0) return;
    
    newPackages.forEach(pkg => notifiedPackagesRef.current.add(pkg));
    
    const packageList = newPackages.length <= 3 
      ? newPackages.join(', ')
      : `${newPackages.slice(0, 3).join(', ')} and ${newPackages.length - 3} more`;
    
    toast({
      title: 'Missing packages detected',
      description: `The following packages may need to be installed: ${packageList}`,
      variant: 'default',
    });
  }, [toast]);

  useEffect(() => {
    if (!showNotifications || missingPackageNames.length === 0) return;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      showMissingPackageNotification(missingPackageNames);
    }, notificationDebounceMs);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [missingPackageNames, showNotifications, notificationDebounceMs, showMissingPackageNotification]);

  const clearNotifiedPackages = useCallback(() => {
    notifiedPackagesRef.current.clear();
  }, []);

  return {
    detectedPackages,
    missingPackages,
    missingPackageNames,
    installCommand,
    hasMissingPackages: missingPackages.length > 0,
    clearNotifiedPackages,
    showMissingPackageNotification,
    suggestPackage: suggestPackageFromPattern,
    packagePatterns: PACKAGE_PATTERNS,
  };
}
