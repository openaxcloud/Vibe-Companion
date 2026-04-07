import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from './admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { Book, BookOpen, FolderOpen, Plus, Search, Loader2, Edit, Trash2 } from 'lucide-react';

interface Documentation {
  id: number;
  categoryId: number | null;
  slug: string;
  title: string;
  excerpt: string | null;
  order: number;
  status: string;
  version: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export default function AdminDocs() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'docs' | 'categories'>('docs');

  const { data: docs = [], isLoading: docsLoading } = useQuery<Documentation[]>({
    queryKey: ['/api/admin/docs'],
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<DocCategory[]>({
    queryKey: ['/api/admin/docs/categories'],
  });

  const isLoading = docsLoading || catsLoading;

  const filteredDocs = docs.filter(d =>
    !search ||
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCats = categories.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const published = docs.filter(d => d.status === 'published').length;

  const getCategoryName = (id: number | null) =>
    categories.find(c => c.id === id)?.name ?? 'Uncategorized';

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Documentation</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage platform documentation and categories</p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Article
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Book className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Articles</p>
                  <p className="text-xl font-bold">{docs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Published</p>
                  <p className="text-xl font-bold">{published}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Categories</p>
                  <p className="text-xl font-bold">{categories.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab('docs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'docs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Articles ({docs.length})
          </button>
          <button
            onClick={() => setTab('categories')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'categories'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Categories ({categories.length})
          </button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {tab === 'docs' ? 'Documentation Articles' : 'Documentation Categories'}
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tab === 'docs' ? 'Search articles...' : 'Search categories...'}
                  className="pl-8 h-9 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tab === 'docs' ? (
              filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Book className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? 'No articles match your search' : 'No documentation articles yet'}
                  </p>
                  <Button size="sm" variant="outline" className="mt-4 gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Create Article
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getCategoryName(doc.categoryId)}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[doc.status] || STATUS_COLORS.draft} variant="secondary">
                            {doc.status || 'draft'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.version || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : (
              filteredCats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? 'No categories match your search' : 'No documentation categories yet'}
                  </p>
                  <Button size="sm" variant="outline" className="mt-4 gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Create Category
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCats.map(cat => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">{cat.slug}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {cat.description || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{cat.order}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
