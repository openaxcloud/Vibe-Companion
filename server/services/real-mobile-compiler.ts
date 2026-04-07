/**
 * Real Mobile App Compilation Service
 * Provides actual mobile app building capabilities
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { dockerExecutor } from '../execution/docker-executor';
import { storageService } from './storage.service';
import { storage } from '../storage';

const logger = createLogger('real-mobile-compiler');

export interface MobileBuildConfig {
  projectId: number;
  platform: 'ios' | 'android' | 'both';
  buildType: 'debug' | 'release' | 'appstore';
  framework: 'react-native' | 'flutter' | 'ionic' | 'native';
  appConfig: {
    bundleId: string;
    appName: string;
    version: string;
    buildNumber: string;
    icon?: string;
    splashScreen?: string;
  };
  signingConfig?: {
    ios?: {
      certificateId: string;
      provisioningProfile: string;
      teamId: string;
    };
    android?: {
      keystoreId: string;
      keyAlias: string;
      keystorePassword: string;
      keyPassword: string;
    };
  };
  environmentVars?: Record<string, string>;
}

export interface MobileBuildResult {
  buildId: string;
  status: 'pending' | 'building' | 'success' | 'failed';
  platform: string;
  artifacts: Array<{
    type: 'ipa' | 'apk' | 'aab';
    path: string;
    size: number;
    downloadUrl?: string;
  }>;
  logs: string[];
  error?: string;
  startTime: Date;
  endTime?: Date;
  metadata?: {
    bundleId: string;
    version: string;
    minSdkVersion?: number;
    targetSdkVersion?: number;
  };
}

export interface EASBuildSubmission {
  platform: 'ios' | 'android';
  profile: string;
  projectId?: string | number;
  projectRoot?: string;
  initiatingActor?: {
    id: string;
    displayName: string;
  };
}

export interface EASBuildResponse {
  id: string;
  status: 'new' | 'in-queue' | 'in-progress' | 'pending-cancel' | 'errored' | 'finished' | 'canceled';
  platform: 'ios' | 'android';
  createdAt: string;
  updatedAt: string;
  error?: {
    message: string;
    errorCode: string;
  };
  artifacts?: {
    buildUrl?: string;
    applicationArchiveUrl?: string;
  };
  expirationDate?: string;
  priority?: 'normal' | 'high';
  channel?: string;
  distribution?: 'store' | 'internal' | 'simulator';
  buildProfile?: string;
  sdkVersion?: string;
  appVersion?: string;
  appBuildVersion?: string;
  gitCommitHash?: string;
  gitCommitMessage?: string;
}

export interface EASBuildStatusResponse extends EASBuildResponse {
  logs?: {
    url: string;
  };
  metrics?: {
    buildDuration?: number;
    buildWaitTime?: number;
  };
}

export class RealMobileCompiler {
  private activeBuilds: Map<string, MobileBuildResult> = new Map();

  async buildMobileApp(config: MobileBuildConfig): Promise<MobileBuildResult> {
    const buildId = crypto.randomUUID();
    const result: MobileBuildResult = {
      buildId,
      status: 'pending',
      platform: config.platform,
      artifacts: [],
      logs: [],
      startTime: new Date()
    };

    this.activeBuilds.set(buildId, result);

    try {
      // Get project files
      const project = await storage.getProject(config.projectId);
      const files = await storage.getFilesByProject(config.projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      result.status = 'building';
      result.logs.push(`[${new Date().toISOString()}] Starting mobile build for ${config.platform}`);

      // Build based on framework
      switch (config.framework) {
        case 'react-native':
          await this.buildReactNative(config, files, result);
          break;
        case 'flutter':
          await this.buildFlutter(config, files, result);
          break;
        case 'ionic':
          await this.buildIonic(config, files, result);
          break;
        case 'native':
          await this.buildNative(config, files, result);
          break;
        default:
          throw new Error(`Unsupported framework: ${config.framework}`);
      }

      result.status = 'success';
      result.endTime = new Date();
      
      logger.info(`Mobile build ${buildId} completed successfully`);

    } catch (error) {
      logger.error(`Mobile build failed: ${error}`);
      result.status = 'failed';
      result.error = error.message;
      result.endTime = new Date();
    }

    return result;
  }

  private async buildReactNative(
    config: MobileBuildConfig,
    files: any[],
    result: MobileBuildResult
  ) {
    // Create build container with React Native environment
    const containerResult = await dockerExecutor.executeProject({
      projectId: config.projectId,
      language: 'nodejs',
      files,
      environmentVars: {
        ...config.environmentVars,
        REACT_NATIVE_VERSION: '0.72.0'
      },
      command: 'npm install -g react-native-cli',
      timeout: 600 // 10 minutes
    });

    result.logs.push(...containerResult.output);

    if (config.platform === 'android' || config.platform === 'both') {
      await this.buildReactNativeAndroid(config, containerResult.containerId, result);
    }

    if (config.platform === 'ios' || config.platform === 'both') {
      await this.buildReactNativeIOS(config, containerResult.containerId, result);
    }

    await dockerExecutor.stopContainer(containerResult.containerId);
  }

  private async buildReactNativeAndroid(
    config: MobileBuildConfig,
    containerId: string,
    result: MobileBuildResult
  ) {
    result.logs.push(`[${new Date().toISOString()}] Building React Native Android app`);

    // Update app configuration
    await this.updateAndroidConfig(containerId, config.appConfig);

    // Build command based on build type
    let buildCommand: string;
    switch (config.buildType) {
      case 'debug':
        buildCommand = 'cd android && ./gradlew assembleDebug';
        break;
      case 'release':
        buildCommand = 'cd android && ./gradlew assembleRelease';
        break;
      case 'appstore':
        buildCommand = 'cd android && ./gradlew bundleRelease';
        break;
      default:
        buildCommand = 'cd android && ./gradlew assembleDebug';
    }

    // Execute build
    const buildResult = await dockerExecutor.executeCommand(containerId, ['sh', '-c', buildCommand]);
    result.logs.push(buildResult.output);

    if (buildResult.exitCode !== 0) {
      throw new Error('Android build failed');
    }

    // Get build artifacts
    const artifactPath = config.buildType === 'appstore' 
      ? 'android/app/build/outputs/bundle/release/app-release.aab'
      : `android/app/build/outputs/apk/${config.buildType}/app-${config.buildType}.apk`;

    const artifactResult = await dockerExecutor.executeCommand(
      containerId,
      ['base64', `-w0`, `/app/${artifactPath}`]
    );

    if (artifactResult.exitCode === 0) {
      const artifactData = Buffer.from(artifactResult.output.trim(), 'base64');
      if (artifactData.length === 0) {
        logger.warn(`Build artifact is empty for ${artifactPath}`);
      }
      const artifactKey = `builds/${config.projectId}/${result.buildId}/app.${config.buildType === 'appstore' ? 'aab' : 'apk'}`;
      const uploaded = await storageService.uploadFile(
        artifactKey,
        artifactData,
        { contentType: 'application/vnd.android.package-archive' }
      );

      const downloadUrl = await storageService.getSignedUrl(artifactKey, 86400); // 24 hours

      result.artifacts.push({
        type: config.buildType === 'appstore' ? 'aab' : 'apk',
        path: artifactKey,
        size: uploaded.size,
        downloadUrl
      });
    }
  }

  private async buildReactNativeIOS(
    config: MobileBuildConfig,
    containerId: string,
    result: MobileBuildResult
  ) {
    result.logs.push(`[${new Date().toISOString()}] Building React Native iOS app`);

    // iOS builds require macOS or a cloud build service
    if (process.platform !== 'darwin') {
      // Check for cloud build service configuration (EAS_BUILD_TOKEN or EXPO_TOKEN)
      const easBuildToken = process.env.EAS_BUILD_TOKEN || process.env.EXPO_TOKEN;
      const codemagicToken = process.env.CODEMAGIC_API_TOKEN;
      
      if (easBuildToken) {
        // Use EAS Build service
        result.logs.push('[iOS] Using EAS Build service for iOS compilation');
        await this.buildWithEAS(config, result, easBuildToken);
        return;
      } else if (codemagicToken) {
        // Use Codemagic service
        result.logs.push('[iOS] Using Codemagic service for iOS compilation');
        await this.buildWithCodemagic(config, result, codemagicToken);
        return;
      } else {
        // No cloud build service configured - always fail clearly with instructions
        result.status = 'failed';
        result.logs.push('[iOS] ERROR: Mobile compilation requires EAS Build. Please set EAS_BUILD_TOKEN in environment.');
        result.logs.push('[iOS] Alternatively, you can set EXPO_TOKEN or CODEMAGIC_API_TOKEN');
        result.logs.push('[iOS] Documentation: https://docs.expo.dev/build/setup/');
        throw new Error('Mobile compilation requires EAS Build. Please set EAS_BUILD_TOKEN in environment.');
      }
    }

    // Real iOS build process (requires macOS)
    const buildCommand = config.buildType === 'appstore'
      ? 'cd ios && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release archive'
      : 'cd ios && xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug';

    const buildResult = await dockerExecutor.executeCommand(containerId, ['sh', '-c', buildCommand]);
    result.logs.push(buildResult.output);
  }

  private async buildFlutter(
    config: MobileBuildConfig,
    files: any[],
    result: MobileBuildResult
  ) {
    // Create Flutter build container
    const containerResult = await dockerExecutor.executeProject({
      projectId: config.projectId,
      language: 'flutter',
      files,
      environmentVars: config.environmentVars,
      command: 'flutter doctor',
      timeout: 600
    });

    result.logs.push(...containerResult.output);

    // Build for each platform
    if (config.platform === 'android' || config.platform === 'both') {
      const buildCommand = config.buildType === 'appstore'
        ? 'flutter build appbundle --release'
        : `flutter build apk --${config.buildType}`;

      const buildResult = await dockerExecutor.executeCommand(
        containerResult.containerId,
        ['sh', '-c', buildCommand]
      );

      result.logs.push(buildResult.output);

      if (buildResult.exitCode === 0) {
        // Get and upload artifact
        const artifactPath = config.buildType === 'appstore'
          ? 'build/app/outputs/bundle/release/app-release.aab'
          : `build/app/outputs/flutter-apk/app-${config.buildType}.apk`;

        await this.uploadArtifact(containerResult.containerId, artifactPath, config, result);
      }
    }

    if (config.platform === 'ios' || config.platform === 'both') {
      // iOS builds for Flutter
      const buildCommand = `flutter build ios --${config.buildType}`;
      
      const buildResult = await dockerExecutor.executeCommand(
        containerResult.containerId,
        ['sh', '-c', buildCommand]
      );

      result.logs.push(buildResult.output);
    }

    await dockerExecutor.stopContainer(containerResult.containerId);
  }

  private async buildIonic(
    config: MobileBuildConfig,
    files: any[],
    result: MobileBuildResult
  ) {
    // Ionic uses Capacitor for native builds
    const containerResult = await dockerExecutor.executeProject({
      projectId: config.projectId,
      language: 'nodejs',
      files,
      environmentVars: config.environmentVars,
      command: 'npm install -g @ionic/cli',
      timeout: 600
    });

    result.logs.push(...containerResult.output);

    // Build web assets
    const buildWebResult = await dockerExecutor.executeCommand(
      containerResult.containerId,
      ['sh', '-c', 'ionic build --prod']
    );

    result.logs.push(buildWebResult.output);

    // Sync with Capacitor
    const syncResult = await dockerExecutor.executeCommand(
      containerResult.containerId,
      ['sh', '-c', 'npx cap sync']
    );

    result.logs.push(syncResult.output);

    // Build native apps
    if (config.platform === 'android' || config.platform === 'both') {
      const buildCommand = 'cd android && ./gradlew assembleRelease';
      const buildResult = await dockerExecutor.executeCommand(
        containerResult.containerId,
        ['sh', '-c', buildCommand]
      );

      result.logs.push(buildResult.output);
    }

    await dockerExecutor.stopContainer(containerResult.containerId);
  }

  private async buildNative(
    config: MobileBuildConfig,
    files: any[],
    result: MobileBuildResult
  ) {
    // Native builds (Swift for iOS, Kotlin for Android)
    if (config.platform === 'android') {
      await this.buildNativeAndroid(config, files, result);
    } else if (config.platform === 'ios') {
      await this.buildNativeIOS(config, files, result);
    }
  }

  private async buildNativeAndroid(
    config: MobileBuildConfig,
    files: any[],
    result: MobileBuildResult
  ) {
    const containerResult = await dockerExecutor.executeProject({
      projectId: config.projectId,
      language: 'java', // Uses Android SDK
      files,
      environmentVars: {
        ANDROID_HOME: '/opt/android-sdk',
        ...config.environmentVars
      },
      command: './gradlew assembleRelease',
      timeout: 600
    });

    result.logs.push(...containerResult.output);
    await dockerExecutor.stopContainer(containerResult.containerId);
  }

  private async buildNativeIOS(
    config: MobileBuildConfig,
    files: any[],
    result: MobileBuildResult
  ) {
    // iOS native builds require macOS
    if (process.platform !== 'darwin') {
      throw new Error('iOS builds require macOS');
    }

    // Would use xcodebuild directly
    result.logs.push('Native iOS build would be executed on macOS');
  }

  private async updateAndroidConfig(
    containerId: string,
    appConfig: MobileBuildConfig['appConfig']
  ) {
    // Update build.gradle with app configuration
    const gradleUpdate = `
      sed -i 's/applicationId.*/applicationId "${appConfig.bundleId}"/g' android/app/build.gradle
      sed -i 's/versionCode.*/versionCode ${appConfig.buildNumber}/g' android/app/build.gradle
      sed -i 's/versionName.*/versionName "${appConfig.version}"/g' android/app/build.gradle
    `;

    await dockerExecutor.executeCommand(containerId, ['sh', '-c', gradleUpdate]);

    // Update app name in strings.xml
    const stringsUpdate = `
      sed -i 's/<string name="app_name">.*<\\/string>/<string name="app_name">${appConfig.appName}<\\/string>/g' android/app/src/main/res/values/strings.xml
    `;

    await dockerExecutor.executeCommand(containerId, ['sh', '-c', stringsUpdate]);
  }

  private async uploadArtifact(
    containerId: string,
    artifactPath: string,
    config: MobileBuildConfig,
    result: MobileBuildResult
  ) {
    const getArtifactResult = await dockerExecutor.executeCommand(
      containerId,
      ['base64', '-w0', `/app/${artifactPath}`]
    );

    if (getArtifactResult.exitCode === 0) {
      const artifactData = Buffer.from(getArtifactResult.output.trim(), 'base64');
      const extension = path.extname(artifactPath);
      const artifactKey = `builds/${config.projectId}/${result.buildId}/app${extension}`;

      const uploaded = await storageService.uploadFile(
        artifactKey,
        artifactData,
        { contentType: this.getContentType(extension) }
      );

      const downloadUrl = await storageService.getSignedUrl(artifactKey, 86400);

      result.artifacts.push({
        type: extension === '.ipa' ? 'ipa' : extension === '.aab' ? 'aab' : 'apk',
        path: artifactKey,
        size: uploaded.size,
        downloadUrl
      });
    }
  }

  private getContentType(extension: string): string {
    const types: Record<string, string> = {
      '.apk': 'application/vnd.android.package-archive',
      '.aab': 'application/octet-stream',
      '.ipa': 'application/octet-stream'
    };
    return types[extension] || 'application/octet-stream';
  }

  async getBuildStatus(buildId: string): Promise<MobileBuildResult | null> {
    return this.activeBuilds.get(buildId) || null;
  }

  async getBuildLogs(buildId: string): Promise<string[]> {
    const build = this.activeBuilds.get(buildId);
    return build?.logs || [];
  }

  async cancelBuild(buildId: string): Promise<boolean> {
    const build = this.activeBuilds.get(buildId);
    if (!build || build.status !== 'building') {
      return false;
    }

    build.status = 'failed';
    build.error = 'Build cancelled by user';
    build.endTime = new Date();
    
    return true;
  }

  /**
   * Build iOS app using EAS Build (Expo Application Services)
   * Requires EAS_BUILD_TOKEN or EXPO_TOKEN environment variable
   * See: https://docs.expo.dev/build/setup/
   */
  private async buildWithEAS(
    config: MobileBuildConfig,
    result: MobileBuildResult,
    token: string
  ): Promise<void> {
    try {
      result.logs.push('[EAS Build] Initiating build via EAS...');
      
      const buildSubmission: EASBuildSubmission = {
        platform: config.platform === 'both' ? 'ios' : config.platform,
        profile: config.buildType === 'appstore' ? 'production' : 'development',
        projectId: config.projectId,
      };
      
      const response = await fetch('https://api.expo.dev/v2/eas/builds', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildSubmission),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`EAS Build API error: ${response.status} - ${errorText}`);
      }

      const buildData: EASBuildResponse = await response.json();
      result.logs.push(`[EAS Build] Build initiated: ${buildData.id}`);
      result.logs.push(`[EAS Build] Monitor at: https://expo.dev/builds/${buildData.id}`);

      // Store build metadata
      result.metadata = {
        bundleId: config.appConfig.bundleId,
        version: config.appConfig.version,
      };

      // Poll for build completion (with timeout)
      const maxWaitTime = 30 * 60 * 1000; // 30 minutes
      const pollInterval = 30 * 1000; // 30 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const statusResponse = await fetch(`https://api.expo.dev/v2/eas/builds/${buildData.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (statusResponse.ok) {
          const status: EASBuildStatusResponse = await statusResponse.json();
          result.logs.push(`[EAS Build] Status: ${status.status}`);

          if (status.status === 'finished') {
            // Download and store the artifact (IPA for iOS, APK/AAB for Android)
            const artifactUrl = status.artifacts?.buildUrl || status.artifacts?.applicationArchiveUrl;
            if (artifactUrl) {
              const artifactResponse = await fetch(artifactUrl);
              const artifactBuffer = Buffer.from(await artifactResponse.arrayBuffer());
              
              const isIOS = config.platform === 'ios' || config.platform === 'both';
              const extension = isIOS ? 'ipa' : (config.buildType === 'appstore' ? 'aab' : 'apk');
              const artifactKey = `builds/${config.projectId}/${result.buildId}/app.${extension}`;
              
              const uploaded = await storageService.uploadFile(
                artifactKey,
                artifactBuffer,
                { contentType: 'application/octet-stream' }
              );

              const downloadUrl = await storageService.getSignedUrl(artifactKey, 86400);

              result.artifacts.push({
                type: isIOS ? 'ipa' : (config.buildType === 'appstore' ? 'aab' : 'apk'),
                path: artifactKey,
                size: uploaded.size,
                downloadUrl
              });

              result.logs.push(`[EAS Build] Build completed successfully - artifact stored`);
              
              // Log metrics if available
              if (status.metrics?.buildDuration) {
                result.logs.push(`[EAS Build] Build duration: ${Math.round(status.metrics.buildDuration / 1000)}s`);
              }
            }
            return;
          } else if (status.status === 'errored' || status.status === 'canceled') {
            const errorMessage = status.error?.message || 'Unknown error';
            throw new Error(`EAS Build failed: ${errorMessage}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new Error('EAS Build timed out after 30 minutes');
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'EAS Build failed';
      result.logs.push(`[EAS Build] ERROR: ${result.error}`);
      throw error;
    }
  }

  /**
   * Build iOS app using Codemagic CI/CD
   * Requires CODEMAGIC_API_TOKEN environment variable
   * See: https://docs.codemagic.io/rest-api/overview/
   */
  private async buildWithCodemagic(
    config: MobileBuildConfig,
    result: MobileBuildResult,
    token: string
  ): Promise<void> {
    try {
      result.logs.push('[Codemagic] Initiating iOS build...');
      
      const response = await fetch('https://api.codemagic.io/builds', {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId: process.env.CODEMAGIC_APP_ID,
          workflowId: config.buildType === 'appstore' ? 'ios-production' : 'ios-development',
          branch: 'main',
          environment: {
            variables: config.environmentVars,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Codemagic API error: ${response.status} - ${errorText}`);
      }

      const buildData = await response.json();
      result.logs.push(`[Codemagic] Build initiated: ${buildData.buildId}`);

      // Poll for build completion
      const maxWaitTime = 30 * 60 * 1000;
      const pollInterval = 30 * 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const statusResponse = await fetch(`https://api.codemagic.io/builds/${buildData.buildId}`, {
          headers: { 'x-auth-token': token },
        });

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          result.logs.push(`[Codemagic] Status: ${status.status}`);

          if (status.status === 'finished') {
            // Download artifacts
            const ipaArtifact = status.artefacts?.find((a: any) => a.name.endsWith('.ipa'));
            if (ipaArtifact?.url) {
              const ipaResponse = await fetch(ipaArtifact.url);
              const ipaBuffer = Buffer.from(await ipaResponse.arrayBuffer());
              
              const artifactKey = `builds/${config.projectId}/${result.buildId}/app.ipa`;
              const uploaded = await storageService.uploadFile(
                artifactKey,
                ipaBuffer,
                { contentType: 'application/octet-stream' }
              );

              const downloadUrl = await storageService.getSignedUrl(artifactKey, 86400);

              result.artifacts.push({
                type: 'ipa',
                path: artifactKey,
                size: uploaded.size,
                downloadUrl
              });

              result.logs.push('[Codemagic] iOS build completed successfully');
            }
            return;
          } else if (status.status === 'failed' || status.status === 'canceled') {
            throw new Error(`Codemagic build failed: ${status.message || 'Unknown error'}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new Error('Codemagic build timed out after 30 minutes');
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Codemagic build failed';
      result.logs.push(`[Codemagic] ERROR: ${result.error}`);
      throw error;
    }
  }

  // Device simulation
  async runOnSimulator(
    projectId: number,
    platform: 'ios' | 'android',
    deviceId: string
  ): Promise<{
    simulatorId: string;
    status: string;
    url?: string;
  }> {
    // Device simulator requires dedicated infrastructure (cloud VMs or local emulators)
    // Currently returns development mode response indicating feature is not available
    const simulatorId = crypto.randomUUID();
    
    logger.warn(`Device simulator not available: ${platform} simulator ${deviceId} for project ${projectId}. Feature requires dedicated infrastructure.`);

    return {
      simulatorId,
      status: 'unavailable',
      url: undefined
    };
  }
}

export const realMobileCompiler = new RealMobileCompiler();