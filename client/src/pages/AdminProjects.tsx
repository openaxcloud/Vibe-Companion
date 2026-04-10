import { AdminLayout } from './admin/AdminLayout';
import { ProjectManagement } from '@/components/admin/ProjectManagement';

export default function AdminProjects() {
  return (
    <AdminLayout>
      <ProjectManagement />
    </AdminLayout>
  );
}
