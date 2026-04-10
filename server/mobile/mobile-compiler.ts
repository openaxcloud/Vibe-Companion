import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { storage } from '../storage';

const execAsync = promisify(exec);

export interface MobileBuildConfig {
  projectId: number;
  platform: 'ios' | 'android';
  buildType: 'debug' | 'release' | 'appstore' | 'playstore';
  framework: 'react-native' | 'flutter' | 'ionic' | 'native';
  config: {
    bundleId: string;
    versionName: string;
    versionCode: number;
    appName: string;
    icon?: string;
    splashScreen?: string;
    permissions?: string[];
    sdkVersions?: {
      minSdk?: number;
      targetSdk?: number;
      compileSdk?: number;
    };
  };
}

export interface MobileBuildResult {
  buildId: string;
  platform: string;
  buildType: string;
  status: 'queued' | 'building' | 'success' | 'failed';
  artifactUrl?: string;
  logs: string[];
  startTime: Date;
  endTime?: Date;
  metadata?: {
    size?: number;
    sha256?: string;
    bundleId?: string;
    version?: string;
  };
}

export class MobileCompiler {
  private buildsDir: string;
  private artifactsDir: string;

  constructor() {
    this.buildsDir = path.join(process.cwd(), 'mobile-builds');
    this.artifactsDir = path.join(process.cwd(), 'build-artifacts');
  }

  async init() {
    await fs.mkdir(this.buildsDir, { recursive: true });
    await fs.mkdir(this.artifactsDir, { recursive: true });
  }

  async buildApp(config: MobileBuildConfig): Promise<MobileBuildResult> {
    const buildId = crypto.randomBytes(16).toString('hex');
    const buildDir = path.join(this.buildsDir, buildId);
    
    const result: MobileBuildResult = {
      buildId,
      platform: config.platform,
      buildType: config.buildType,
      status: 'building',
      logs: [],
      startTime: new Date(),
    };

    try {
      // Create build directory
      await fs.mkdir(buildDir, { recursive: true });
      
      // Copy project files
      await this.copyProjectFiles(config.projectId, buildDir);
      
      // Build based on framework
      switch (config.framework) {
        case 'react-native':
          await this.buildReactNative(buildDir, config, result);
          break;
        case 'flutter':
          await this.buildFlutter(buildDir, config, result);
          break;
        case 'ionic':
          await this.buildIonic(buildDir, config, result);
          break;
        case 'native':
          await this.buildNative(buildDir, config, result);
          break;
      }
      
      result.status = 'success';
      result.endTime = new Date();
      
    } catch (error) {
      result.status = 'failed';
      result.logs.push(`Build failed: ${error.message}`);
      result.endTime = new Date();
    } finally {
      // Cleanup build directory
      await fs.rm(buildDir, { recursive: true, force: true });
    }
    
    // Save build result
    await this.saveBuildResult(result);
    
    return result;
  }

  private async buildReactNative(
    buildDir: string, 
    config: MobileBuildConfig, 
    result: MobileBuildResult
  ): Promise<void> {
    // Update app configuration
    await this.updateReactNativeConfig(buildDir, config);
    
    if (config.platform === 'ios') {
      // iOS build
      result.logs.push('Installing iOS dependencies...');
      await execAsync('cd ios && pod install', { cwd: buildDir });
      
      if (config.buildType === 'debug') {
        result.logs.push('Building iOS debug app...');
        await execAsync('npx react-native run-ios --configuration Debug', { cwd: buildDir });
      } else {
        result.logs.push('Building iOS release app...');
        const scheme = 'Release';
        const archivePath = path.join(buildDir, 'build', 'app.xcarchive');
        
        await execAsync(
          `xcodebuild -workspace ios/App.xcworkspace -scheme App -configuration ${scheme} ` +
          `-archivePath ${archivePath} archive`,
          { cwd: buildDir }
        );
        
        if (config.buildType === 'appstore') {
          result.logs.push('Exporting for App Store...');
          const exportPath = path.join(buildDir, 'build', 'export');
          await execAsync(
            `xcodebuild -exportArchive -archivePath ${archivePath} ` +
            `-exportPath ${exportPath} -exportOptionsPlist ios/ExportOptions.plist`,
            { cwd: buildDir }
          );
          
          // Move IPA to artifacts
          const ipaPath = path.join(exportPath, 'App.ipa');
          const artifactPath = await this.moveToArtifacts(ipaPath, `${config.config.bundleId}-${config.config.versionName}.ipa`);
          result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
        }
      }
    } else {
      // Android build
      result.logs.push('Building Android app...');
      
      if (config.buildType === 'debug') {
        await execAsync('npx react-native run-android --variant=debug', { cwd: buildDir });
      } else {
        const variant = config.buildType === 'playstore' ? 'release' : 'release';
        await execAsync(`cd android && ./gradlew assemble${variant}`, { cwd: buildDir });
        
        // Move APK/AAB to artifacts
        const ext = config.buildType === 'playstore' ? 'aab' : 'apk';
        const buildOutput = path.join(buildDir, 'android', 'app', 'build', 'outputs', ext, variant, `app-${variant}.${ext}`);
        const artifactPath = await this.moveToArtifacts(buildOutput, `${config.config.bundleId}-${config.config.versionName}.${ext}`);
        result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
      }
    }
  }

  private async buildFlutter(
    buildDir: string, 
    config: MobileBuildConfig, 
    result: MobileBuildResult
  ): Promise<void> {
    // Update Flutter configuration
    await this.updateFlutterConfig(buildDir, config);
    
    result.logs.push('Getting Flutter dependencies...');
    await execAsync('flutter pub get', { cwd: buildDir });
    
    if (config.platform === 'ios') {
      if (config.buildType === 'debug') {
        result.logs.push('Building Flutter iOS debug app...');
        await execAsync('flutter build ios --debug', { cwd: buildDir });
      } else {
        result.logs.push('Building Flutter iOS release app...');
        await execAsync('flutter build ios --release', { cwd: buildDir });
        
        if (config.buildType === 'appstore') {
          result.logs.push('Creating IPA for App Store...');
          await execAsync('flutter build ipa', { cwd: buildDir });
          
          const ipaPath = path.join(buildDir, 'build', 'ios', 'ipa', '*.ipa');
          const artifactPath = await this.moveToArtifacts(ipaPath, `${config.config.bundleId}-${config.config.versionName}.ipa`);
          result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
        }
      }
    } else {
      if (config.buildType === 'debug') {
        result.logs.push('Building Flutter Android debug app...');
        await execAsync('flutter build apk --debug', { cwd: buildDir });
      } else if (config.buildType === 'playstore') {
        result.logs.push('Building Flutter Android App Bundle...');
        await execAsync('flutter build appbundle', { cwd: buildDir });
        
        const aabPath = path.join(buildDir, 'build', 'app', 'outputs', 'bundle', 'release', 'app-release.aab');
        const artifactPath = await this.moveToArtifacts(aabPath, `${config.config.bundleId}-${config.config.versionName}.aab`);
        result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
      } else {
        result.logs.push('Building Flutter Android release APK...');
        await execAsync('flutter build apk --release', { cwd: buildDir });
        
        const apkPath = path.join(buildDir, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
        const artifactPath = await this.moveToArtifacts(apkPath, `${config.config.bundleId}-${config.config.versionName}.apk`);
        result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
      }
    }
  }

  private async buildIonic(
    buildDir: string, 
    config: MobileBuildConfig, 
    result: MobileBuildResult
  ): Promise<void> {
    // Update Ionic configuration
    await this.updateIonicConfig(buildDir, config);
    
    result.logs.push('Installing Ionic dependencies...');
    await execAsync('npm install', { cwd: buildDir });
    
    result.logs.push('Building Ionic app...');
    await execAsync('ionic build', { cwd: buildDir });
    
    if (config.platform === 'ios') {
      result.logs.push('Adding iOS platform...');
      await execAsync('ionic capacitor add ios', { cwd: buildDir });
      
      result.logs.push('Syncing iOS project...');
      await execAsync('ionic capacitor sync ios', { cwd: buildDir });
      
      if (config.buildType === 'debug') {
        result.logs.push('Opening in Xcode for debug build...');
        await execAsync('ionic capacitor open ios', { cwd: buildDir });
      } else {
        // Build with xcodebuild
        await this.buildIosWithXcodebuild(buildDir, config, result);
      }
    } else {
      result.logs.push('Adding Android platform...');
      await execAsync('ionic capacitor add android', { cwd: buildDir });
      
      result.logs.push('Syncing Android project...');
      await execAsync('ionic capacitor sync android', { cwd: buildDir });
      
      if (config.buildType === 'debug') {
        result.logs.push('Building Android debug APK...');
        await execAsync('cd android && ./gradlew assembleDebug', { cwd: buildDir });
      } else {
        await this.buildAndroidWithGradle(buildDir, config, result);
      }
    }
  }

  private async buildNative(
    buildDir: string, 
    config: MobileBuildConfig, 
    result: MobileBuildResult
  ): Promise<void> {
    if (config.platform === 'ios') {
      // Native iOS (Swift)
      await this.buildIosWithXcodebuild(buildDir, config, result);
    } else {
      // Native Android (Kotlin/Java)
      await this.buildAndroidWithGradle(buildDir, config, result);
    }
  }

  private async buildIosWithXcodebuild(
    buildDir: string,
    config: MobileBuildConfig,
    result: MobileBuildResult
  ): Promise<void> {
    const workspace = await this.findXcodeWorkspace(buildDir);
    const scheme = await this.findXcodeScheme(buildDir);
    const configuration = config.buildType === 'debug' ? 'Debug' : 'Release';
    
    result.logs.push(`Building iOS ${configuration} with xcodebuild...`);
    
    const archivePath = path.join(buildDir, 'build', 'app.xcarchive');
    await execAsync(
      `xcodebuild -workspace ${workspace} -scheme ${scheme} ` +
      `-configuration ${configuration} -archivePath ${archivePath} ` +
      `archive DEVELOPMENT_TEAM=${process.env.IOS_DEVELOPMENT_TEAM || ''}`,
      { cwd: buildDir }
    );
    
    if (config.buildType === 'appstore') {
      const exportPath = path.join(buildDir, 'build', 'export');
      await execAsync(
        `xcodebuild -exportArchive -archivePath ${archivePath} ` +
        `-exportPath ${exportPath} -exportOptionsPlist ExportOptions.plist`,
        { cwd: buildDir }
      );
      
      const ipaFiles = await fs.readdir(exportPath);
      const ipaFile = ipaFiles.find(f => f.endsWith('.ipa'));
      if (ipaFile) {
        const artifactPath = await this.moveToArtifacts(
          path.join(exportPath, ipaFile),
          `${config.config.bundleId}-${config.config.versionName}.ipa`
        );
        result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
      }
    }
  }

  private async buildAndroidWithGradle(
    buildDir: string,
    config: MobileBuildConfig,
    result: MobileBuildResult
  ): Promise<void> {
    const variant = config.buildType === 'debug' ? 'Debug' : 'Release';
    
    result.logs.push(`Building Android ${variant}...`);
    
    if (config.buildType === 'playstore') {
      await execAsync(`cd android && ./gradlew bundle${variant}`, { cwd: buildDir });
      
      const aabPath = path.join(buildDir, 'android', 'app', 'build', 'outputs', 'bundle', variant.toLowerCase(), `app-${variant.toLowerCase()}.aab`);
      const artifactPath = await this.moveToArtifacts(aabPath, `${config.config.bundleId}-${config.config.versionName}.aab`);
      result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
    } else {
      await execAsync(`cd android && ./gradlew assemble${variant}`, { cwd: buildDir });
      
      const apkPath = path.join(buildDir, 'android', 'app', 'build', 'outputs', 'apk', variant.toLowerCase(), `app-${variant.toLowerCase()}.apk`);
      const artifactPath = await this.moveToArtifacts(apkPath, `${config.config.bundleId}-${config.config.versionName}.apk`);
      result.artifactUrl = `/api/mobile/download/${path.basename(artifactPath)}`;
    }
  }

  private async updateReactNativeConfig(buildDir: string, config: MobileBuildConfig): Promise<void> {
    // Update app.json
    const appJsonPath = path.join(buildDir, 'app.json');
    const appJson = JSON.parse(await fs.readFile(appJsonPath, 'utf-8'));
    appJson.name = config.config.appName;
    appJson.displayName = config.config.appName;
    await fs.writeFile(appJsonPath, JSON.stringify(appJson, null, 2));
    
    // Update iOS Info.plist
    if (config.platform === 'ios') {
      const plistPath = path.join(buildDir, 'ios', 'App', 'Info.plist');
      let plist = await fs.readFile(plistPath, 'utf-8');
      plist = plist.replace(/<key>CFBundleIdentifier<\/key>\s*<string>.*<\/string>/, 
        `<key>CFBundleIdentifier</key><string>${config.config.bundleId}</string>`);
      plist = plist.replace(/<key>CFBundleShortVersionString<\/key>\s*<string>.*<\/string>/, 
        `<key>CFBundleShortVersionString</key><string>${config.config.versionName}</string>`);
      await fs.writeFile(plistPath, plist);
    }
    
    // Update Android build.gradle
    if (config.platform === 'android') {
      const gradlePath = path.join(buildDir, 'android', 'app', 'build.gradle');
      let gradle = await fs.readFile(gradlePath, 'utf-8');
      gradle = gradle.replace(/applicationId\s+".*"/, `applicationId "${config.config.bundleId}"`);
      gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${config.config.versionCode}`);
      gradle = gradle.replace(/versionName\s+".*"/, `versionName "${config.config.versionName}"`);
      await fs.writeFile(gradlePath, gradle);
    }
  }

  private async updateFlutterConfig(buildDir: string, config: MobileBuildConfig): Promise<void> {
    // Update pubspec.yaml
    const pubspecPath = path.join(buildDir, 'pubspec.yaml');
    let pubspec = await fs.readFile(pubspecPath, 'utf-8');
    pubspec = pubspec.replace(/version:\s+.*/, `version: ${config.config.versionName}+${config.config.versionCode}`);
    await fs.writeFile(pubspecPath, pubspec);
    
    // Update iOS configuration
    if (config.platform === 'ios') {
      const xconfigPath = path.join(buildDir, 'ios', 'Flutter', 'Release.xcconfig');
      const xcconfig = `PRODUCT_BUNDLE_IDENTIFIER=${config.config.bundleId}\n`;
      await fs.writeFile(xconfigPath, xcconfig);
    }
    
    // Update Android configuration
    if (config.platform === 'android') {
      const gradlePath = path.join(buildDir, 'android', 'app', 'build.gradle');
      let gradle = await fs.readFile(gradlePath, 'utf-8');
      gradle = gradle.replace(/applicationId\s+".*"/, `applicationId "${config.config.bundleId}"`);
      await fs.writeFile(gradlePath, gradle);
    }
  }

  private async updateIonicConfig(buildDir: string, config: MobileBuildConfig): Promise<void> {
    // Update capacitor.config.json
    const capacitorConfigPath = path.join(buildDir, 'capacitor.config.json');
    const capacitorConfig = JSON.parse(await fs.readFile(capacitorConfigPath, 'utf-8'));
    capacitorConfig.appId = config.config.bundleId;
    capacitorConfig.appName = config.config.appName;
    await fs.writeFile(capacitorConfigPath, JSON.stringify(capacitorConfig, null, 2));
  }

  private async copyProjectFiles(projectId: number, buildDir: string): Promise<void> {
    const projectDir = path.join(process.cwd(), 'projects', String(projectId));
    await this.copyDirectory(projectDir, buildDir);
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async findXcodeWorkspace(buildDir: string): Promise<string> {
    const iosDir = path.join(buildDir, 'ios');
    const files = await fs.readdir(iosDir);
    const workspace = files.find(f => f.endsWith('.xcworkspace'));
    return workspace || 'App.xcworkspace';
  }

  private async findXcodeScheme(buildDir: string): Promise<string> {
    return 'App'; // Default scheme name
  }

  private async moveToArtifacts(sourcePath: string, fileName: string): Promise<string> {
    const artifactPath = path.join(this.artifactsDir, fileName);
    await fs.copyFile(sourcePath, artifactPath);
    return artifactPath;
  }

  private async saveBuildResult(result: MobileBuildResult): Promise<void> {
    // Save build result to storage
    // Implementation pending database schema update
  }

  async getBuildStatus(buildId: string): Promise<MobileBuildResult | null> {
    // Retrieve build status from storage
    return null;
  }

  async downloadArtifact(fileName: string): Promise<string> {
    const artifactPath = path.join(this.artifactsDir, fileName);
    const exists = await fs.access(artifactPath).then(() => true).catch(() => false);
    
    if (!exists) {
      throw new Error('Artifact not found');
    }
    
    return artifactPath;
  }
}

export const mobileCompiler = new MobileCompiler();