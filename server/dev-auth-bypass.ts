/**
 * Module pour contourner l'authentification en développement
 * NE PAS UTILISER EN PRODUCTION !
 */

import { Request, Response, NextFunction } from "express";

// Variable pour activer/désactiver le contournement d'auth
let bypassAuth = false;

// Middleware qui peut contourner l'authentification
export const devAuthBypass = (req: Request, res: Response, next: NextFunction) => {
  // Si le contournement est activé, nous simulons un utilisateur authentifié
  if (bypassAuth && process.env.NODE_ENV === 'development') {
    // Si isAuthenticated() est déjà true, continuez normalement
    if (req.isAuthenticated()) {
      return next();
    }
    
    // Simuler l'authentification pour le développement
    req.isAuthenticated = () => true;
    
    // Simuler un utilisateur administrateur
    req.user = {
      id: 1,
      username: 'admin',
      displayName: 'Admin User',
      email: 'admin@example.com',
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      password: '***PROTECTED***'
    } as any;
    
    console.log('⚠️ Auth Bypass: Simulation d\'authentification activée pour cette demande');
  }
  
  next();
};

// Endpoint pour activer/désactiver le contournement (en développement uniquement)
export function setupAuthBypass(app: any) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  // Endpoint pour activer le contournement
  app.get('/api/debug/bypass-auth/enable', (req: Request, res: Response) => {
    bypassAuth = true;
    console.log('⚠️ Auth Bypass: ACTIVÉ - Toutes les vérifications d\'authentification seront ignorées');
    res.json({ 
      status: 'enabled',
      warning: 'Le contournement d\'authentification est activé. À utiliser uniquement pour le développement.' 
    });
  });
  
  // Endpoint pour désactiver le contournement
  app.get('/api/debug/bypass-auth/disable', (req: Request, res: Response) => {
    bypassAuth = false;
    console.log('✅ Auth Bypass: DÉSACTIVÉ - L\'authentification normale est restaurée');
    res.json({ status: 'disabled' });
  });
  
  // Endpoint pour vérifier l'état
  app.get('/api/debug/bypass-auth/status', (req: Request, res: Response) => {
    res.json({ 
      status: bypassAuth ? 'enabled' : 'disabled',
      mode: process.env.NODE_ENV
    });
  });
  
  console.log('🔧 Auth Bypass: Points de terminaison de débogage initialisés pour le développement');
}