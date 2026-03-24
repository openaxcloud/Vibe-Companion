import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Download, Mail, Building2 } from "lucide-react";

export default function CommercialAgreement() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-commercial-agreement">
      <PublicNavbar />
      
      <section className="py-responsive">
        <div className="container-responsive">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5" />
              <span className="text-[13px] text-muted-foreground">Enterprise</span>
            </div>

            <h1 className="text-responsive-2xl font-bold tracking-tight mb-4" data-testid="heading-commercial-agreement">
              E-Code Commercial Agreement
            </h1>
            
            <p className="text-responsive-base text-muted-foreground mb-8">
              Master Services Agreement for E-Code Enterprise Customers
            </p>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">1. Services</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">1.1 Service Description</h3>
                <p>E-Code will provide Customer with access to the E-Code platform and related services as described in the applicable Order Form(s) (the "Services").</p>
                
                <h3 className="font-semibold text-base mt-6">1.2 Service Levels</h3>
                <p>E-Code will use commercially reasonable efforts to make the Services available 99.9% of the time in each calendar month. Service Level Agreement details are available in the Enterprise plan documentation.</p>
                
                <h3 className="font-semibold text-base mt-6">1.3 Support</h3>
                <p>E-Code will provide Customer with enterprise support services, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>24/7 priority support via email and phone</li>
                  <li>Dedicated customer success manager</li>
                  <li>Response time SLAs: Critical - 1 hour, High - 4 hours, Normal - 1 business day</li>
                  <li>Access to beta features and early releases</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">2. Customer Obligations</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">2.1 Acceptable Use</h3>
                <p>Customer will use the Services only for lawful purposes and in accordance with this Agreement and the Acceptable Use Policy.</p>
                
                <h3 className="font-semibold text-base mt-6">2.2 Customer Data</h3>
                <p>Customer retains all right, title, and interest in and to Customer Data. Customer grants E-Code a limited license to use Customer Data solely to provide the Services.</p>
                
                <h3 className="font-semibold text-base mt-6">2.3 Compliance</h3>
                <p>Customer will comply with all applicable laws and regulations in its use of the Services.</p>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">3. Fees and Payment</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">3.1 Fees</h3>
                <p>Customer will pay E-Code the fees set forth in the applicable Order Form(s).</p>
                
                <h3 className="font-semibold text-base mt-6">3.2 Payment Terms</h3>
                <p>Unless otherwise specified in an Order Form:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Fees are due annually in advance</li>
                  <li>Payment is due within 30 days of invoice date</li>
                  <li>Late payments accrue interest at 1.5% per month</li>
                  <li>All fees are non-refundable except as expressly provided herein</li>
                </ul>
                
                <h3 className="font-semibold text-base mt-6">3.3 Taxes</h3>
                <p>Fees do not include taxes. Customer is responsible for all taxes associated with its purchase, excluding taxes based on E-Code's net income.</p>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">4. Proprietary Rights</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">4.1 E-Code Technology</h3>
                <p>E-Code retains all right, title, and interest in and to the Services, including all software, technology, and intellectual property rights therein.</p>
                
                <h3 className="font-semibold text-base mt-6">4.2 Feedback</h3>
                <p>Customer grants E-Code a worldwide, perpetual, irrevocable, royalty-free license to use any feedback or suggestions provided by Customer.</p>
                
                <h3 className="font-semibold text-base mt-6">4.3 Restrictions</h3>
                <p>Customer will not:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Reverse engineer or attempt to discover the source code of the Services</li>
                  <li>Modify, adapt, or create derivative works of the Services</li>
                  <li>Remove or obscure any proprietary notices</li>
                  <li>Use the Services to build a competitive product</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">5. Confidentiality</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">5.1 Definition</h3>
                <p>"Confidential Information" means all non-public information disclosed by one party to the other, whether orally or in writing, that is designated as confidential or that reasonably should be understood to be confidential.</p>
                
                <h3 className="font-semibold text-base mt-6">5.2 Obligations</h3>
                <p>Each party will:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Hold the other party's Confidential Information in confidence</li>
                  <li>Not disclose it to third parties without prior written consent</li>
                  <li>Use it only to fulfill its obligations under this Agreement</li>
                  <li>Protect it using the same degree of care it uses for its own confidential information</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">6. Warranties and Disclaimers</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">6.1 Mutual Warranties</h3>
                <p>Each party warrants that it has the legal power and authority to enter into this Agreement.</p>
                
                <h3 className="font-semibold text-base mt-6">6.2 Service Warranty</h3>
                <p>E-Code warrants that the Services will perform materially in accordance with the applicable documentation.</p>
                
                <h3 className="font-semibold text-base mt-6">6.3 Disclaimer</h3>
                <p className="uppercase">EXCEPT AS EXPRESSLY PROVIDED HEREIN, THE SERVICES ARE PROVIDED "AS IS" AND E-CODE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.</p>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">7. Indemnification</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">7.1 By E-Code</h3>
                <p>E-Code will defend Customer against any third-party claim that the Services infringe any patent, copyright, or trademark, and will indemnify Customer for any damages awarded.</p>
                
                <h3 className="font-semibold text-base mt-6">7.2 By Customer</h3>
                <p>Customer will defend E-Code against any third-party claim arising from Customer's use of the Services in violation of this Agreement or applicable law.</p>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">8. Limitation of Liability</h2>
              <div className="space-y-4 text-[13px]">
                <p className="uppercase">IN NO EVENT WILL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE.</p>
                <p className="uppercase mt-4">EACH PARTY'S TOTAL LIABILITY WILL NOT EXCEED THE FEES PAID BY CUSTOMER IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">9. Term and Termination</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">9.1 Term</h3>
                <p>This Agreement begins on the Effective Date and continues for the Initial Term specified in the Order Form, automatically renewing for successive Renewal Terms unless either party provides 90 days' notice of non-renewal.</p>
                
                <h3 className="font-semibold text-base mt-6">9.2 Termination for Cause</h3>
                <p>Either party may terminate this Agreement if the other party materially breaches and fails to cure within 30 days of written notice.</p>
                
                <h3 className="font-semibold text-base mt-6">9.3 Effect of Termination</h3>
                <p>Upon termination:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Customer's access to the Services will cease</li>
                  <li>E-Code will make Customer Data available for download for 30 days</li>
                  <li>All accrued fees become immediately due</li>
                  <li>Sections 4, 5, 7, 8, and 10 survive termination</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">10. General Provisions</h2>
              <div className="space-y-4 text-[13px]">
                <h3 className="font-semibold text-base">10.1 Governing Law</h3>
                <p>This Agreement is governed by the laws of Delaware, USA, without regard to conflict of law principles.</p>
                
                <h3 className="font-semibold text-base mt-6">10.2 Entire Agreement</h3>
                <p>This Agreement, including all Order Forms, constitutes the entire agreement between the parties and supersedes all prior agreements.</p>
                
                <h3 className="font-semibold text-base mt-6">10.3 Amendment</h3>
                <p>This Agreement may only be amended in writing signed by both parties.</p>
                
                <h3 className="font-semibold text-base mt-6">10.4 Assignment</h3>
                <p>Neither party may assign this Agreement without the other party's prior written consent, except in connection with a merger or acquisition.</p>
              </div>
            </Card>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="flex items-center gap-2 min-h-[44px]" data-testid="button-commercial-download">
                <Download className="h-4 w-4" />
                Download Agreement
              </Button>
              <Button size="lg" variant="outline" className="flex items-center gap-2 min-h-[44px]" data-testid="button-commercial-contact">
                <Mail className="h-4 w-4" />
                Contact Sales
              </Button>
            </div>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-[13px] text-muted-foreground">
                <strong>Version:</strong> 2.0<br />
                <strong>Last Updated:</strong> January 1, 2025<br />
                For questions about this agreement, please contact <a href="mailto:enterprise@e-code.ai" className="text-primary hover:underline">enterprise@e-code.ai</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}