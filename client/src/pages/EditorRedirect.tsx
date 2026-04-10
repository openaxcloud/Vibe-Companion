import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ECodeLoading } from "@/components/ECodeLoading";

/**
 * @deprecated Legacy /editor/:id route - redirects to /ide/:id
 * 
 * This component maintains backward compatibility for old /editor/:id URLs
 * by redirecting them to the new unified /ide/:id route using SPA navigation.
 * 
 * Migration Path:
 * - All new features should use /ide/:id route
 * - Old bookmarks/links to /editor/:id will continue working
 * - Consider removing this redirect in a future version once migration is complete
 */
export default function EditorRedirect() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (id) {
      // Preserve query parameters and hash fragments from legacy URLs
      // This ensures ?agent=true, #section, and other deep links continue working
      const search = window.location.search;
      const hash = window.location.hash;
      const newPath = `/ide/${id}${search}${hash}`;
      
      // Use replace: true to avoid history bloat (don't add intermediate redirect to history)
      setLocation(newPath, { replace: true });
    }
  }, [id, setLocation]);

  return <ECodeLoading fullScreen size="lg" text="Redirecting to workspace..." />;
}
