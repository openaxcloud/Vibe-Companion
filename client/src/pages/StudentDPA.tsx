import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { GraduationCap, Shield, FileText, CheckCircle, Users, Lock, AlertCircle, Download } from 'lucide-react';
import { Link } from 'wouter';

export default function StudentDPA() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="py-responsive bg-gradient-subtle">
        <div className="container-responsive">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-5 w-5 text-primary" />
            <Badge variant="secondary">FERPA Compliant</Badge>
          </div>
          
          <h1 className="text-responsive-2xl font-bold tracking-tight mb-4">
            US Student Data Privacy Agreement
          </h1>
          
          <p className="text-responsive-base text-muted-foreground max-w-3xl">
            E-Code is committed to protecting student privacy and ensuring compliance with the Family 
            Educational Rights and Privacy Act (FERPA) and state student privacy laws. This agreement 
            outlines our commitments to educational institutions.
          </p>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg">
              <a href="/assets/ecode-student-dpa.pdf" download>
                <Download className="mr-2 h-4 w-4" />
                Download Student DPA
              </a>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link href="/contact-sales">Request Signed Agreement</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Key Commitments */}
      <section className="py-responsive border-b">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-6">Our Commitments to Educational Institutions</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">FERPA Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We act as a "School Official" under FERPA, handling education records only 
                  as directed by the educational institution.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Lock className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Data Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Industry-standard encryption, secure data centers, and comprehensive security 
                  measures protect student information.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Limited Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Student data is accessed only by authorized personnel on a need-to-know basis 
                  for providing educational services.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Agreement Overview */}
      <section className="py-responsive">
        <div className="container-responsive">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-semibold mb-6">Agreement Overview</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Purpose and Scope</h3>
                  <p className="text-sm text-muted-foreground">
                    This Student Data Privacy Agreement ("DPA") governs the use of E-Code's services 
                    by educational institutions and ensures compliance with applicable student privacy laws.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Data Ownership</h3>
                  <p className="text-sm text-muted-foreground">
                    Educational institutions retain full ownership and control of student data. 
                    E-Code processes this data solely to provide the requested services.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Permitted Uses</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    <li>Providing coding education platform services</li>
                    <li>Maintaining and improving platform functionality</li>
                    <li>Generating de-identified analytics for the institution</li>
                    <li>Ensuring platform security and preventing abuse</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-6">Privacy Protections</h2>
              
              <div className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">No Sale of Student Data</p>
                        <p className="text-sm text-muted-foreground">
                          We never sell, rent, or trade student information to third parties.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">No Behavioral Advertising</p>
                        <p className="text-sm text-muted-foreground">
                          Student data is never used for targeted advertising or marketing.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Parental Rights</p>
                        <p className="text-sm text-muted-foreground">
                          We support parental access, correction, and deletion rights as required by law.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Data Deletion</p>
                        <p className="text-sm text-muted-foreground">
                          Student data is deleted upon request or contract termination.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* State-Specific Compliance */}
      <section className="py-responsive bg-muted/30">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-6">State Privacy Law Compliance</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>We Comply with State Student Privacy Laws</CardTitle>
              <CardDescription>
                Including but not limited to the following state requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">California (SOPIPA)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">New York (Ed Law 2-d)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Connecticut (PA 16-189)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Colorado (C.R.S. 22-16-101)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Utah (SPPA)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">And many others</span>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <p className="text-sm text-muted-foreground">
                Our standard Student DPA is designed to meet the requirements of all state student 
                privacy laws. We also accommodate state-specific addenda when required.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Data Security Measures */}
      <section className="py-responsive">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-6">Data Security Measures</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium mb-4">Technical Safeguards</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">256-bit SSL encryption for data in transit</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">AES-256 encryption for data at rest</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">Regular security audits and penetration testing</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">24/7 security monitoring and intrusion detection</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-4">Administrative Safeguards</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">Background checks for all employees</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">Annual privacy and security training</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">Strict access controls and audit logging</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span className="text-sm">Incident response and breach notification procedures</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="py-responsive bg-yellow-50 dark:bg-yellow-950/20">
        <div className="container-responsive">
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <CardTitle>Important Notice for Educators</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                This Student DPA applies only to institutional accounts created and managed by 
                educational institutions. Individual student accounts created outside of an 
                institutional agreement are governed by our standard Terms of Service and Privacy Policy.
              </p>
              
              <p className="text-sm">
                To ensure FERPA compliance and proper student data protection, educational institutions 
                should contact our sales team to establish an institutional agreement before allowing 
                student use of E-Code.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-responsive border-t">
        <div className="container-responsive text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to Bring E-Code to Your School?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Our education team is here to help you implement E-Code while ensuring full compliance 
            with student privacy requirements. Get a signed Student DPA and institutional pricing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/contact-sales">Contact Education Sales</Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link href="/privacy">View Privacy Policy</Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}