import { instrumentedLazy } from "../utils/instrumented-lazy";

export const NotFound = instrumentedLazy(() => import("@/pages/not-found"), "NotFound");
export const Home = instrumentedLazy(() => import("@/pages/Home"), "Home");
export const Editor = instrumentedLazy(() => import("@/pages/Editor"), "Editor");
export const IDEPage = instrumentedLazy(() => import("@/pages/IDEPage"), "IDEPage");
export const EditorRedirect = instrumentedLazy(() => import("@/pages/EditorRedirect"), "EditorRedirect");
export const AuthPage = instrumentedLazy(() => import("@/pages/auth-page"), "AuthPage");
export const ProjectsPage = instrumentedLazy(() => import("@/pages/ProjectsPage"), "ProjectsPage");

export { default as Login } from "@/pages/Login";
export { default as Register } from "@/pages/Register";
export { default as ForgotPassword } from "@/pages/ForgotPassword";
export { default as ResetPassword } from "@/pages/ResetPassword";
export { default as VerifyEmail } from "@/pages/VerifyEmail";
export const ProjectPage = instrumentedLazy(() => import("@/pages/ProjectPage"), "ProjectPage");
export const RuntimesPage = instrumentedLazy(() => import("@/pages/RuntimesPage"), "RuntimesPage");
export const RuntimeDiagnosticsPage = instrumentedLazy(() => import("@/pages/RuntimeDiagnosticsPage"), "RuntimeDiagnosticsPage");
export const RuntimePublicPage = instrumentedLazy(() => import("@/pages/RuntimePublicPage"), "RuntimePublicPage");

export const Dashboard = instrumentedLazy(() => import("@/pages/Dashboard"), "Dashboard");
export const Explore = instrumentedLazy(() => import("@/pages/Explore"), "Explore");
export const Teams = instrumentedLazy(() => import("@/pages/Teams"), "Teams");
export const Notifications = instrumentedLazy(() => import("@/pages/Notifications"), "Notifications");
export const Analytics = instrumentedLazy(() => import("@/pages/Analytics"), "Analytics");

export const Education = instrumentedLazy(() => import("@/pages/Education"), "Education");
export const Marketplace = instrumentedLazy(() => import("@/pages/Marketplace"), "Marketplace");
export const TemplateMarketplace = instrumentedLazy(() => import("@/pages/TemplateMarketplace"), "TemplateMarketplace");

export const TeamPage = instrumentedLazy(() => import("@/pages/TeamPage"), "TeamPage");
export const TeamSettings = instrumentedLazy(() => import("@/pages/TeamSettings"), "TeamSettings");
export const Settings = instrumentedLazy(() => import("@/pages/Settings"), "Settings");
export const Profile = instrumentedLazy(() => import("@/pages/Profile"), "Profile");
export const UserProfile = instrumentedLazy(() => import("@/pages/UserProfile"), "UserProfile");
export const UserSettings = instrumentedLazy(() => import("@/pages/UserSettings"), "UserSettings");
export const TemplatesPage = instrumentedLazy(() => import("@/pages/TemplatesPage"), "TemplatesPage");
export const Community = instrumentedLazy(() => import("@/pages/Community"), "Community");
export const CommunityPost = instrumentedLazy(() => import("@/pages/CommunityPost"), "CommunityPost");
export const SearchPage = instrumentedLazy(() => import("@/pages/SearchPage"), "SearchPage");
export const AdminDashboard = instrumentedLazy(() => import("@/pages/AdminDashboard"), "AdminDashboard");
export const AdminUsage = instrumentedLazy(() => import("@/pages/AdminUsage"), "AdminUsage");
export const AdminAIUsage = instrumentedLazy(() => import("@/pages/AdminAIUsage"), "AdminAIUsage");
export const AdminBilling = instrumentedLazy(() => import("@/pages/AdminBilling"), "AdminBilling");
export const AdminAIModels = instrumentedLazy(() => import("@/pages/admin/AIModels"), "AdminAIModels");
export const AdminFormRequests = instrumentedLazy(() => import("@/pages/admin/FormRequests"), "AdminFormRequests");
export const AdminAIOptimization = instrumentedLazy(() => import("@/pages/admin/AIOptimizationDashboard"), "AdminAIOptimization");
export const AdminSEOManagement = instrumentedLazy(() => import("@/pages/admin/SEOManagement"), "AdminSEOManagement");
export const AdminMonitoring = instrumentedLazy(() => import("@/pages/admin/AdminMonitoring"), "AdminMonitoring");
export const AdminSystemMonitoring = instrumentedLazy(() => import("@/pages/admin/SystemMonitoring"), "AdminSystemMonitoring");
export const PitchDeck = instrumentedLazy(() => import("@/pages/admin/PitchDeck"), "PitchDeck");
export const ChatGPTAdmin = instrumentedLazy(() => import("@/pages/ChatGPTAdmin"), "ChatGPTAdmin");
export const AdminUsers = instrumentedLazy(() => import("@/pages/AdminUsers"), "AdminUsers");
export const AdminProjects = instrumentedLazy(() => import("@/pages/AdminProjects"), "AdminProjects");
export const AdminSubscriptions = instrumentedLazy(() => import("@/pages/AdminSubscriptions"), "AdminSubscriptions");
export const AdminActivityLogs = instrumentedLazy(() => import("@/pages/AdminActivityLogs"), "AdminActivityLogs");
export const AdminSettings = instrumentedLazy(() => import("@/pages/AdminSettings"), "AdminSettings");
export const AdminApiKeys = instrumentedLazy(() => import("@/pages/AdminApiKeys"), "AdminApiKeys");
export const AdminSupport = instrumentedLazy(() => import("@/pages/AdminSupport"), "AdminSupport");
export const AdminCMS = instrumentedLazy(() => import("@/pages/AdminCMS"), "AdminCMS");
export const AdminDocs = instrumentedLazy(() => import("@/pages/AdminDocs"), "AdminDocs");

export const Landing = instrumentedLazy(() => import("@/pages/LandingOptimized"), "Landing");
export const Pricing = instrumentedLazy(() => import("@/pages/Pricing"), "Pricing");
export const Features = instrumentedLazy(() => import("@/pages/Features"), "Features");
export const About = instrumentedLazy(() => import("@/pages/About"), "About");
export const Careers = instrumentedLazy(() => import("@/pages/Careers"), "Careers");
export const Blog = instrumentedLazy(() => import("@/pages/Blog"), "Blog");
export const BlogDetail = instrumentedLazy(() => import("@/pages/BlogDetail"), "BlogDetail");
export const Docs = instrumentedLazy(() => import("@/pages/Docs"), "Docs");
export const ContactSales = instrumentedLazy(() => import("@/pages/ContactSales"), "ContactSales");
export const Terms = instrumentedLazy(() => import("@/pages/Terms"), "Terms");
export const Privacy = instrumentedLazy(() => import("@/pages/Privacy"), "Privacy");
export const Status = instrumentedLazy(() => import("@/pages/Status"), "Status");
export const Forum = instrumentedLazy(() => import("@/pages/Forum"), "Forum");
export const ComparePage = instrumentedLazy(() => import("@/pages/compare/ComparePage"), "ComparePage");

export const MobileAdmin = instrumentedLazy(() => import("@/pages/admin/MobileAdminDashboard"), "MobileAdmin");
export const MobileWorkspace = instrumentedLazy(() => import("@/pages/MobileWorkspace"), "MobileWorkspace");
export const MobileMarketingPage = instrumentedLazy(() => import("@/pages/mobile"), "MobileMarketingPage");
export const AI = instrumentedLazy(() => import("@/pages/AI"), "AI");
export const Press = instrumentedLazy(() => import("@/pages/Press"), "Press");
export const Partners = instrumentedLazy(() => import("@/pages/Partners"), "Partners");
export const Security = instrumentedLazy(() => import("@/pages/Security"), "Security");
export const Desktop = instrumentedLazy(() => import("@/pages/Desktop"), "Desktop");

export const AIAgentStudio = instrumentedLazy(() => import("@/pages/AIAgentStudio"), "AIAgentStudio");
export const AgentActivity = instrumentedLazy(() => import("@/pages/AgentActivity"), "AgentActivity");
export const PublicTeamPage = instrumentedLazy(() => import("@/pages/PublicTeamPage"), "PublicTeamPage");
export const PublicDeploymentsPage = instrumentedLazy(() => import("@/pages/PublicDeploymentsPage"), "PublicDeploymentsPage");
export const Scalability = instrumentedLazy(() => import("@/pages/Scalability"), "Scalability");
export const MarketingBounties = instrumentedLazy(() => import("@/pages/marketing/Bounties"), "MarketingBounties");

export const Compare = instrumentedLazy(() => import("@/pages/marketing/Compare"), "Compare");
export const VsGitHubCodespaces = instrumentedLazy(() => import("@/pages/marketing/VsGitHubCodespaces"), "VsGitHubCodespaces");
export const VsGlitch = instrumentedLazy(() => import("@/pages/marketing/VsGlitch"), "VsGlitch");
export const VsHeroku = instrumentedLazy(() => import("@/pages/marketing/VsHeroku"), "VsHeroku");
export const VsCodeSandbox = instrumentedLazy(() => import("@/pages/marketing/VsCodeSandbox"), "VsCodeSandbox");
export const VsAwsCloud9 = instrumentedLazy(() => import("@/pages/marketing/VsAwsCloud9"), "VsAwsCloud9");

export const AuthenticationDemo = instrumentedLazy(() =>
  import("@/components/AuthenticationDemo").then((module) => ({
    default: module.AuthenticationDemo,
  })),
  "AuthenticationDemo"
);

export const Account = instrumentedLazy(() => import("@/pages/Account"), "Account");
export const ThemeValidation = instrumentedLazy(() => import("@/pages/ThemeValidation"), "ThemeValidation");
export const Deployments = instrumentedLazy(() => import("@/pages/Deployments"), "Deployments");
export const Learn = instrumentedLazy(() => import("@/pages/Learn"), "Learn");
export const Support = instrumentedLazy(() => import("@/pages/Support"), "Support");
export const Themes = instrumentedLazy(() => import("@/pages/Themes"), "Themes");
export const Usage = instrumentedLazy(() => import("@/pages/Usage"), "Usage");
export const Billing = instrumentedLazy(() => import("@/pages/Billing"), "Billing");
export const Subscribe = instrumentedLazy(() => import("@/pages/Subscribe"), "Subscribe");
export const Plans = instrumentedLazy(() => import("@/pages/Plans"), "Plans");
export const Cycles = instrumentedLazy(() => import("@/pages/Cycles"), "Cycles");
export const Bounties = instrumentedLazy(() => import("@/pages/Bounties"), "Bounties");
export const PowerUps = instrumentedLazy(() => import("@/pages/PowerUps"), "PowerUps");
export const Badges = instrumentedLazy(() => import("@/pages/Badges"), "Badges");

export const SSOConfiguration = instrumentedLazy(() => import("@/pages/SSOConfiguration"), "SSOConfiguration");
export const AuditLogs = instrumentedLazy(() => import("@/pages/AuditLogs"), "AuditLogs");
export const CustomRoles = instrumentedLazy(() => import("@/pages/CustomRoles"), "CustomRoles");
export const Subprocessors = instrumentedLazy(() => import("@/pages/Subprocessors"), "Subprocessors");
export const HealthDashboard = instrumentedLazy(() => import("@/pages/HealthDashboard"), "HealthDashboard");
export const StudentDPA = instrumentedLazy(() => import("@/pages/StudentDPA"), "StudentDPA");
export const Languages = instrumentedLazy(() => import("@/pages/Languages"), "Languages");
export const GitHubImport = instrumentedLazy(() => import("@/pages/GitHubImport"), "GitHubImport");

export const Secrets = instrumentedLazy(() => import("@/pages/Secrets"), "Secrets");
export const Workflows = instrumentedLazy(() => import("@/pages/Workflows"), "Workflows");
export const SSH = instrumentedLazy(() => import("@/pages/SSH"), "SSH");
export const SecurityScanner = instrumentedLazy(() => import("@/pages/SecurityScanner"), "SecurityScanner");
export const Dependencies = instrumentedLazy(() => import("@/pages/Dependencies"), "Dependencies");
export const ObjectStorage = instrumentedLazy(() => import("@/pages/ObjectStorage"), "ObjectStorage");

export const DatabaseManagement = instrumentedLazy(() => import("@/pages/DatabaseManagement"), "DatabaseManagement");
export const SecretManagement = instrumentedLazy(() => import("@/pages/SecretManagement"), "SecretManagement");
export const UsageAlerts = instrumentedLazy(() => import("@/pages/UsageAlerts"), "UsageAlerts");

export const NewsletterConfirmed = instrumentedLazy(() => import("@/pages/NewsletterConfirmed"), "NewsletterConfirmed");
export const NewsletterConfirm = instrumentedLazy(() => import("@/pages/NewsletterConfirm"), "NewsletterConfirm");
export const NewsletterUnsubscribe = instrumentedLazy(() => import("@/pages/NewsletterUnsubscribe"), "NewsletterUnsubscribe");

export const DPA = instrumentedLazy(() => import("@/pages/DPA"), "DPA");
export const CommercialAgreement = instrumentedLazy(() => import("@/pages/CommercialAgreement"), "CommercialAgreement");
export const ReportAbuse = instrumentedLazy(() => import("@/pages/ReportAbuse"), "ReportAbuse");
export const SharedSnippet = instrumentedLazy(() => import("@/pages/SharedSnippet"), "SharedSnippet");
export const AIDocumentation = instrumentedLazy(() => import("@/pages/AIDocumentation"), "AIDocumentation");

export const APISDKPage = instrumentedLazy(() => import("@/pages/APISDKPage"), "APISDKPage");
export const MobileAppsPage = instrumentedLazy(() => import("@/pages/MobileAppsPage"), "MobileAppsPage");
export const Apps = instrumentedLazy(() => import("@/pages/Apps"), "Apps");
export const FigmaImport = instrumentedLazy(() => import("@/pages/FigmaImport"), "FigmaImport");
export const BoltImport = instrumentedLazy(() => import("@/pages/BoltImport"), "BoltImport");
export const LovableImport = instrumentedLazy(() => import("@/pages/LovableImport"), "LovableImport");

export const PerformanceDashboard = instrumentedLazy(() => import("@/pages/PerformanceDashboard"), "PerformanceDashboard");

export const AppBuilder = instrumentedLazy(() => import("@/pages/solutions/AppBuilder"), "AppBuilder");
export const WebsiteBuilder = instrumentedLazy(() => import("@/pages/solutions/WebsiteBuilder"), "WebsiteBuilder");
export const GameBuilder = instrumentedLazy(() => import("@/pages/solutions/GameBuilder"), "GameBuilder");
export const DashboardBuilder = instrumentedLazy(() => import("@/pages/solutions/DashboardBuilder"), "DashboardBuilder");
export const ChatbotBuilder = instrumentedLazy(() => import("@/pages/solutions/ChatbotBuilder"), "ChatbotBuilder");
export const InternalAIBuilder = instrumentedLazy(() => import("@/pages/solutions/InternalAIBuilder"), "InternalAIBuilder");
export const Enterprise = instrumentedLazy(() => import("@/pages/solutions/Enterprise"), "Enterprise");
export const Startups = instrumentedLazy(() => import("@/pages/solutions/Startups"), "Startups");
export const Freelancers = instrumentedLazy(() => import("@/pages/solutions/Freelancers"), "Freelancers");

export const Tutorials = instrumentedLazy(() => import("@/pages/resources/Tutorials"), "Tutorials");
export const Changelog = instrumentedLazy(() => import("@/pages/resources/Changelog"), "Changelog");
export const CaseStudies = instrumentedLazy(() => import("@/pages/resources/CaseStudies"), "CaseStudies");
export const HelpCenter = instrumentedLazy(() => import("@/pages/resources/HelpCenter"), "HelpCenter");

export const Contact = instrumentedLazy(() => import("@/pages/Contact"), "Contact");
export const Accessibility = instrumentedLazy(() => import("@/pages/Accessibility"), "Accessibility");

export const PreviewWithDevTools = instrumentedLazy(() => import("@/pages/PreviewWithDevTools"), "PreviewWithDevTools");
export const MCPInterface = instrumentedLazy(() => import("@/pages/MCPInterface"), "MCPInterface");
export const PolyglotBackendPage = instrumentedLazy(() => import("@/pages/PolyglotBackendPage"), "PolyglotBackendPage");

export const SolarTechAIChatApp = instrumentedLazy(() => import("@/pages/SolarTechAIChatApp"), "SolarTechAIChatApp");
export const SolarTechCRMApp = instrumentedLazy(() => import("@/pages/SolarTechCRMApp"), "SolarTechCRMApp");
export const SolarTechStoreApp = instrumentedLazy(() => import("@/pages/SolarTechStoreApp"), "SolarTechStoreApp");

export const ApplicationIDEWrapper = instrumentedLazy(() => import("@/components/ApplicationIDEWrapper").then(mod => ({ default: mod.ApplicationIDEWrapper })), "ApplicationIDEWrapper");
export const FeaturePlaceholder = instrumentedLazy(() => import("@/pages/FeaturePlaceholder"), "FeaturePlaceholder");

export const AssistantPage = instrumentedLazy(() => import("@/pages/AssistantPage"), "AssistantPage");
export const CodeSearchPage = instrumentedLazy(() => import("@/pages/CodeSearchPage"), "CodeSearchPage");
export const ProblemsPage = instrumentedLazy(() => import("@/pages/ProblemsPage"), "ProblemsPage");

export const DatabasePage = instrumentedLazy(() => import("@/pages/DatabasePage"), "DatabasePage");
export const ConsolePage = instrumentedLazy(() => import("@/pages/ConsolePage"), "ConsolePage");
export const ShellPage = instrumentedLazy(() => import("@/pages/ShellPage"), "ShellPage");

export const PackagesPage = instrumentedLazy(() => import("@/pages/PackagesPage"), "PackagesPage");
export const KVStorePage = instrumentedLazy(() => import("@/pages/KVStorePage"), "KVStorePage");
export const PreviewPage = instrumentedLazy(() => import("@/pages/PreviewPage"), "PreviewPage");

export const AuthenticationPage = instrumentedLazy(() => import("@/pages/AuthenticationPage"), "AuthenticationPage");
export const ExtensionsPage = instrumentedLazy(() => import("@/pages/ExtensionsPage"), "ExtensionsPage");
export const IntegrationsPage = instrumentedLazy(() => import("@/pages/IntegrationsPage"), "IntegrationsPage");

export const NetworkingPage = instrumentedLazy(() => import("@/pages/NetworkingPage"), "NetworkingPage");
export const ThreadsPage = instrumentedLazy(() => import("@/pages/ThreadsPage"), "ThreadsPage");
export const ReferralsPage = instrumentedLazy(() => import("@/pages/ReferralsPage"), "ReferralsPage");

export const VNCPage = instrumentedLazy(() => import("@/pages/VNCPage"), "VNCPage");
export const NewTeamPage = instrumentedLazy(() => import("@/pages/NewTeamPage"), "NewTeamPage");
