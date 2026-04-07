import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, 
  DialogTitle, DialogTrigger, DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Search, Shield, ShieldOff, Lock, Unlock, 
  Edit, Trash2, UserPlus, RefreshCw, Mail,
  Calendar, Activity, CheckCircle, XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: string;
  lockedUntil?: string;
  failedLoginAttempts: number;
  createdAt: string;
  subscriptionStatus?: string;
}

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const pageSize = 20;

  // Fetch users with pagination and filtering
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['/api/admin/users', { search: searchQuery, status: filterStatus, limit: pageSize, offset: page * pageSize }],
    refetchInterval: 30000
  });

  const users = usersData?.users || [];
  const totalUsers = usersData?.total || 0;
  const totalPages = Math.ceil(totalUsers / pageSize);

  // Toggle admin status mutation
  const toggleAdminMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest('PATCH', `/api/admin/users/${userId}/toggle-admin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Success",
        description: "Admin status updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive"
      });
    }
  });

  // Lock user mutation
  const lockUserMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest('POST', `/api/admin/users/${userId}/lock`, { reason: 'Admin action' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Success",
        description: "User account locked for 24 hours"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to lock user account",
        variant: "destructive"
      });
    }
  });

  // Unlock user mutation
  const unlockUserMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest('POST', `/api/admin/users/${userId}/unlock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Success",
        description: "User account unlocked successfully"
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest('DELETE', `/api/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Success",
        description: "User deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: Partial<User> }) =>
      apiRequest('PATCH', `/api/admin/users/${userId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "User updated successfully"
      });
    }
  });

  const isUserLocked = (user: User) => {
    if (!user.lockedUntil) return false;
    return new Date(user.lockedUntil) > new Date();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts, permissions, and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-search-users"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="select-filter-status" className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="admin">Admins Only</SelectItem>
                <SelectItem value="locked">Locked Accounts</SelectItem>
                <SelectItem value="verified">Email Verified</SelectItem>
                <SelectItem value="2fa">2FA Enabled</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              data-testid="button-refresh"
              variant="outline" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user: User) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.username}</span>
                          {user.displayName && (
                            <span className="text-[13px] text-muted-foreground">{user.displayName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[13px]">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.isAdmin && (
                            <Badge variant="default" className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                          {isUserLocked(user) && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Locked
                            </Badge>
                          )}
                          {user.emailVerified && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </Badge>
                          )}
                          {user.twoFactorEnabled && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              2FA
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? (
                          <div className="flex items-center gap-2 text-[13px]">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            {formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })}
                          </div>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-[13px]">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            data-testid={`button-edit-${user.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            data-testid={`button-toggle-admin-${user.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAdminMutation.mutate(user.id)}
                            disabled={toggleAdminMutation.isPending}
                          >
                            {user.isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                          </Button>

                          {isUserLocked(user) ? (
                            <Button
                              data-testid={`button-unlock-${user.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => unlockUserMutation.mutate(user.id)}
                              disabled={unlockUserMutation.isPending}
                            >
                              <Unlock className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button
                              data-testid={`button-lock-${user.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => lockUserMutation.mutate(user.id)}
                              disabled={lockUserMutation.isPending}
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                data-testid={`button-delete-${user.id}`}
                                variant="ghost"
                                size="sm"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{user.username}</strong>? 
                                  This action cannot be undone and will permanently delete all user data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserMutation.mutate(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">
                Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalUsers)} of {totalUsers} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  data-testid="button-prev-page"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <span className="text-[13px]">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  data-testid="button-next-page"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and settings
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  data-testid="input-edit-username"
                  defaultValue={selectedUser.username}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  data-testid="input-edit-email"
                  defaultValue={selectedUser.email}
                  onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-displayName">Display Name</Label>
                <Input
                  id="edit-displayName"
                  data-testid="input-edit-displayname"
                  defaultValue={selectedUser.displayName || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, displayName: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-save-user"
              onClick={() => {
                if (selectedUser) {
                  updateUserMutation.mutate({
                    userId: selectedUser.id,
                    updates: {
                      email: selectedUser.email,
                      displayName: selectedUser.displayName
                    }
                  });
                }
              }}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
