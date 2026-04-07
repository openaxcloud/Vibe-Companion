import { AdminLayout } from './admin/AdminLayout';
import UserManagement from '@/components/admin/UserManagement';

export default function AdminUsers() {
  return (
    <AdminLayout>
      <UserManagement />
    </AdminLayout>
  );
}
