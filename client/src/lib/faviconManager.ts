type FaviconStatus = 'idle' | 'working' | 'complete' | 'error';

interface FaviconState {
  originalHref: string | null;
  currentStatus: FaviconStatus;
}

const FAVICON_URLS: Record<FaviconStatus, string> = {
  idle: '/favicon.ico',
  working: '/icons/agent/working.svg',
  complete: '/icons/agent/complete.svg',
  error: '/icons/agent/error.svg',
};

class FaviconManagerClass {
  private state: FaviconState = {
    originalHref: null,
    currentStatus: 'idle',
  };
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;

  private getLinkElement(): HTMLLinkElement | null {
    if (typeof document === 'undefined') return null;
    return document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  }

  private saveOriginal(): void {
    if (this.state.originalHref !== null) return;
    const link = this.getLinkElement();
    if (link) {
      this.state.originalHref = link.href;
    }
  }

  setStatus(status: FaviconStatus): void {
    if (typeof document === 'undefined') return;
    
    this.saveOriginal();
    
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }

    const link = this.getLinkElement();
    if (!link) {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = FAVICON_URLS[status];
      document.head.appendChild(newLink);
    } else {
      link.href = FAVICON_URLS[status];
    }

    this.state.currentStatus = status;

    if (status === 'complete' || status === 'error') {
      this.resetTimeout = setTimeout(() => {
        this.reset();
      }, 5000);
    }
  }

  reset(): void {
    if (typeof document === 'undefined') return;
    
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }

    const link = this.getLinkElement();
    if (link && this.state.originalHref) {
      link.href = this.state.originalHref;
    } else if (link) {
      link.href = FAVICON_URLS.idle;
    }

    this.state.currentStatus = 'idle';
  }

  getCurrentStatus(): FaviconStatus {
    return this.state.currentStatus;
  }
}

export const FaviconManager = new FaviconManagerClass();
export type { FaviconStatus };
