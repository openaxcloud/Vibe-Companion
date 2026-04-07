import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Smartphone, 
  Tablet,
  Apple,
  Package,
  Code2,
  Settings,
  PlayCircle,
  Download,
  Upload,
  Wifi,
  WifiOff,
  Battery,
  RotateCw,
  Camera,
  Maximize2,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  Bug,
  Rocket,
  Store
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface MobileAppDevelopmentProps {
  projectId: number;
}

interface MobileDevice {
  id: string;
  name: string;
  type: 'phone' | 'tablet';
  platform: 'ios' | 'android';
  width: number;
  height: number;
  devicePixelRatio: number;
}

const devices: MobileDevice[] = [
  // iOS Devices
  { id: 'iphone14pro', name: 'iPhone 14 Pro', type: 'phone', platform: 'ios', width: 393, height: 852, devicePixelRatio: 3 },
  { id: 'iphone14', name: 'iPhone 14', type: 'phone', platform: 'ios', width: 390, height: 844, devicePixelRatio: 3 },
  { id: 'iphonese', name: 'iPhone SE', type: 'phone', platform: 'ios', width: 375, height: 667, devicePixelRatio: 2 },
  { id: 'ipadpro', name: 'iPad Pro 12.9"', type: 'tablet', platform: 'ios', width: 1024, height: 1366, devicePixelRatio: 2 },
  { id: 'ipadair', name: 'iPad Air', type: 'tablet', platform: 'ios', width: 820, height: 1180, devicePixelRatio: 2 },
  
  // Android Devices
  { id: 'pixel7', name: 'Pixel 7', type: 'phone', platform: 'android', width: 412, height: 915, devicePixelRatio: 2.6 },
  { id: 'galaxys23', name: 'Galaxy S23', type: 'phone', platform: 'android', width: 360, height: 780, devicePixelRatio: 3 },
  { id: 'galaxytab', name: 'Galaxy Tab S8', type: 'tablet', platform: 'android', width: 1600, height: 2560, devicePixelRatio: 2 },
];

export function MobileAppDevelopment({ projectId }: MobileAppDevelopmentProps) {
  const { toast } = useToast();
  const [selectedDevice, setSelectedDevice] = useState<MobileDevice>(devices[0]);
  const [framework, setFramework] = useState<'react-native' | 'flutter' | 'ionic' | 'native'>('react-native');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [networkSpeed, setNetworkSpeed] = useState<'wifi' | '4g' | '3g' | 'offline'>('wifi');
  const [batteryLevel, setBatteryLevel] = useState([80]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [appConfig, setAppConfig] = useState({
    name: 'My Mobile App',
    bundleId: 'com.example.myapp',
    version: '1.0.0',
    description: 'A mobile app built with E-Code',
    minSdkVersion: '21',
    targetSdkVersion: '33',
    iosMinVersion: '13.0'
  });

  const handleBuildApp = async (platform: 'ios' | 'android') => {
    setIsBuilding(true);
    setBuildLogs([]);
    
    try {
      const data = await apiRequest('POST', `/api/mobile/build`, {
        projectId,
        platform,
        framework,
        config: appConfig
      });
      
      // Simulate build process with logs
      const logs = [
        `Starting ${platform.toUpperCase()} build...`,
        `Framework: ${framework}`,
        `Bundle ID: ${appConfig.bundleId}`,
        `Version: ${appConfig.version}`,
        `Preparing build environment...`,
        `Installing dependencies...`,
        `Compiling source code...`,
        `Building native modules...`,
        `Optimizing assets...`,
        `Generating app bundle...`,
        `Build completed successfully!`
      ];

      for (const log of logs) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setBuildLogs(prev => [...prev, log]);
      }

      toast({
        title: "Build Completed",
        description: `Your ${platform} app has been built successfully`,
      });
    } catch (error) {
      toast({
        title: "Build Failed",
        description: "There was an error building your app",
        variant: "destructive",
      });
    } finally {
      setIsBuilding(false);
    }
  };

  const handleDeployToStore = async (store: 'app-store' | 'play-store') => {
    try {
      await apiRequest('POST', `/api/mobile/deploy`, {
        projectId,
        store,
        config: appConfig
      });

      toast({
        title: "Deployment Started",
        description: `Your app is being deployed to ${store === 'app-store' ? 'App Store' : 'Google Play'}`,
      });
    } catch (error) {
      toast({
        title: "Deployment Failed",
        description: "There was an error deploying your app",
        variant: "destructive",
      });
    }
  };

  const handleRunOnDevice = async () => {
    try {
      await apiRequest('POST', `/api/mobile/run`, {
        projectId,
        deviceId: selectedDevice.id,
        framework
      });

      toast({
        title: "App Started",
        description: `Running on ${selectedDevice.name}`,
      });
    } catch (error) {
      toast({
        title: "Failed to Run",
        description: "Could not start app on device",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="preview" className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="build">Build & Deploy</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Select value={selectedDevice.id} onValueChange={(id) => setSelectedDevice(devices.find(d => d.id === id)!)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map(device => (
                      <SelectItem key={device.id} value={device.id}>
                        <div className="flex items-center gap-2">
                          {device.platform === 'ios' ? <Apple className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                          {device.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {/* Take screenshot */}}
                >
                  <Camera className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {/* Fullscreen */}}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={handleRunOnDevice} disabled={isBuilding}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run on Device
              </Button>
            </div>

            <div className="flex items-center gap-6 text-[13px]">
              <div className="flex items-center gap-2">
                {networkSpeed === 'wifi' ? <Wifi className="h-4 w-4" /> : 
                 networkSpeed === 'offline' ? <WifiOff className="h-4 w-4" /> : 
                 <Wifi className="h-4 w-4" />}
                <Select value={networkSpeed} onValueChange={(v: any) => setNetworkSpeed(v)}>
                  <SelectTrigger className="h-8 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wifi">WiFi</SelectItem>
                    <SelectItem value="4g">4G</SelectItem>
                    <SelectItem value="3g">3G</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Battery className="h-4 w-4" />
                <Slider
                  value={batteryLevel}
                  onValueChange={setBatteryLevel}
                  min={0}
                  max={100}
                  step={1}
                  className="w-[100px]"
                />
                <span>{batteryLevel[0]}%</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-8">
            <div 
              className="relative bg-black rounded-[3rem] p-4 shadow-2xl"
              style={{
                width: orientation === 'portrait' ? selectedDevice.width : selectedDevice.height,
                height: orientation === 'portrait' ? selectedDevice.height : selectedDevice.width,
                transform: 'scale(0.7)',
                transformOrigin: 'center'
              }}
            >
              {/* Notch for iPhone */}
              {selectedDevice.platform === 'ios' && selectedDevice.type === 'phone' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-black rounded-b-2xl" />
              )}
              
              {/* Screen */}
              <div className="bg-white h-full rounded-[2rem] overflow-hidden">
                <iframe 
                  src={`/api/mobile/preview/${projectId}?device=${selectedDevice.id}&orientation=${orientation}`}
                  className="w-full h-full border-0"
                  title="Mobile Preview"
                />
              </div>

              {/* Home indicator */}
              {selectedDevice.platform === 'ios' && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white rounded-full opacity-50" />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="config" className="p-4">
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>App Configuration</CardTitle>
                <CardDescription>Configure your mobile app settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="app-name">App Name</Label>
                    <Input
                      id="app-name"
                      value={appConfig.name}
                      onChange={(e) => setAppConfig({...appConfig, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bundle-id">Bundle ID</Label>
                    <Input
                      id="bundle-id"
                      value={appConfig.bundleId}
                      onChange={(e) => setAppConfig({...appConfig, bundleId: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="version">Version</Label>
                    <Input
                      id="version"
                      value={appConfig.version}
                      onChange={(e) => setAppConfig({...appConfig, version: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Framework</Label>
                    <RadioGroup value={framework} onValueChange={(v: any) => setFramework(v)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="react-native" id="react-native" />
                        <Label htmlFor="react-native">React Native</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="flutter" id="flutter" />
                        <Label htmlFor="flutter">Flutter</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ionic" id="ionic" />
                        <Label htmlFor="ionic">Ionic</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="native" id="native" />
                        <Label htmlFor="native">Native (Swift/Kotlin)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={appConfig.description}
                    onChange={(e) => setAppConfig({...appConfig, description: e.target.value})}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="min-sdk">Android Min SDK</Label>
                    <Input
                      id="min-sdk"
                      value={appConfig.minSdkVersion}
                      onChange={(e) => setAppConfig({...appConfig, minSdkVersion: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-sdk">Android Target SDK</Label>
                    <Input
                      id="target-sdk"
                      value={appConfig.targetSdkVersion}
                      onChange={(e) => setAppConfig({...appConfig, targetSdkVersion: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ios-min">iOS Min Version</Label>
                    <Input
                      id="ios-min"
                      value={appConfig.iosMinVersion}
                      onChange={(e) => setAppConfig({...appConfig, iosMinVersion: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permissions</CardTitle>
                <CardDescription>Configure app permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="camera">Camera</Label>
                    <Switch id="camera" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="location">Location Services</Label>
                    <Switch id="location" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifications">Push Notifications</Label>
                    <Switch id="notifications" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="storage">Storage Access</Label>
                    <Switch id="storage" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="microphone">Microphone</Label>
                    <Switch id="microphone" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="build" className="p-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5" />
                    iOS Build
                  </CardTitle>
                  <CardDescription>Build your app for iOS devices</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Build Type</Label>
                    <RadioGroup defaultValue="debug">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="debug" id="ios-debug" />
                        <Label htmlFor="ios-debug">Debug</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="release" id="ios-release" />
                        <Label htmlFor="ios-release">Release</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="app-store" id="ios-appstore" />
                        <Label htmlFor="ios-appstore">App Store</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => handleBuildApp('ios')}
                    disabled={isBuilding}
                  >
                    {isBuilding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Building...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-2" />
                        Build iOS App
                      </>
                    )}
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleDeployToStore('app-store')}
                  >
                    <Store className="h-4 w-4 mr-2" />
                    Deploy to App Store
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Android Build
                  </CardTitle>
                  <CardDescription>Build your app for Android devices</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Build Type</Label>
                    <RadioGroup defaultValue="debug">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="debug" id="android-debug" />
                        <Label htmlFor="android-debug">Debug APK</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="release" id="android-release" />
                        <Label htmlFor="android-release">Release APK</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bundle" id="android-bundle" />
                        <Label htmlFor="android-bundle">App Bundle (AAB)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => handleBuildApp('android')}
                    disabled={isBuilding}
                  >
                    {isBuilding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Building...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-2" />
                        Build Android App
                      </>
                    )}
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleDeployToStore('play-store')}
                  >
                    <Store className="h-4 w-4 mr-2" />
                    Deploy to Google Play
                  </Button>
                </CardContent>
              </Card>
            </div>

            {buildLogs.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Build Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                    <div className="space-y-1 font-mono text-[13px]">
                      {buildLogs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-muted-foreground">[{new Date().toLocaleTimeString()}]</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="debug" className="p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Mobile Debugger
                </CardTitle>
                <CardDescription>Debug your mobile app in real-time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Remote Debugging</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Hot Reload</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Network Inspector</Label>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Performance Monitor</Label>
                    <Switch />
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <Button className="w-full" variant="outline">
                    <FileCode className="h-4 w-4 mr-2" />
                    Open Chrome DevTools
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Info className="h-4 w-4 mr-2" />
                    View Device Logs
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connected Devices</CardTitle>
                <CardDescription>Manage connected physical devices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5" />
                      <div>
                        <p className="font-medium">iPhone 14 Pro (Physical)</p>
                        <p className="text-[13px] text-muted-foreground">iOS 17.0 • Connected via USB</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg opacity-50">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Pixel 7 (Physical)</p>
                        <p className="text-[13px] text-muted-foreground">Android 13 • Not connected</p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Disconnected
                    </Badge>
                  </div>
                </div>

                <Button className="w-full mt-4" variant="outline">
                  <Wifi className="h-4 w-4 mr-2" />
                  Connect via WiFi
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}