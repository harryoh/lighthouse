'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Search,
  Filter,
  Download,
  Eye,
  ExternalLink,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Content {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishedAt: string;
  contentHash: string;
  body: string;
  source?: {
    name: string;
    type: string;
  };
}

interface ContentResponse {
  success: boolean;
  data: Content[];
}

const typeColors: Record<string, string> = {
  NEWS: 'bg-violet-600',
  BLOG: 'bg-blue-600',
  SOCIAL: 'bg-cyan-600',
  COMMUNITY: 'bg-green-600',
};

export default function ContentsPage() {
  const [, setSelectedContent] = useState<Content | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('latest');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchContents();
  }, [currentPage, sortBy, filterType]);

  const fetchContents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        limit: 10,
        sortBy: sortBy === 'latest' ? 'publishedAt' : 'title',
        sortOrder: sortBy === 'oldest' ? 'asc' : 'desc',
      };

      const response = (await api.getContents(params)) as ContentResponse;

      if (response.success) {
        setContents(response.data || []);
      } else {
        throw new Error('Failed to fetch contents');
      }
    } catch (err) {
      console.error('Error fetching contents:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPreview = (body: string) => {
    return body.length > 150 ? body.substring(0, 150) + '...' : body;
  };

  const getSourceType = (content: Content) => {
    return content.source?.type || 'NEWS';
  };

  const getSourceName = (content: Content) => {
    return content.source?.name || 'Unknown Source';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Contents</h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage crawled content
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card glass>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by title, content, or source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
              >
                <option value="all">All Types</option>
                <option value="NEWS">News</option>
                <option value="BLOG">Blog</option>
                <option value="SOCIAL">Social</option>
                <option value="COMMUNITY">Community</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">By Title</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>데이터를 불러오는 중...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card glass>
          <CardContent className="p-6 text-center">
            <div className="text-red-400 mb-2">오류</div>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchContents} variant="outline">
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && contents.length === 0 && (
        <Card glass>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground mb-2">콘텐츠가 없습니다</div>
            <p className="text-sm text-muted-foreground">
              크롤링을 실행하여 콘텐츠를 수집해보세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contents Grid */}
      {!loading && !error && contents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {contents.map((content) => (
            <div key={content.id}>
              <Card
                glass
                className="cursor-pointer hover:border-violet-600/50 transition-all"
                onClick={() => setSelectedContent(content)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium text-white rounded ${
                            typeColors[getSourceType(content)]
                          }`}
                        >
                          {getSourceType(content)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getSourceName(content)}
                        </span>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">
                        {content.title}
                      </CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="ml-2">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {getPreview(content.body)}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {content.author || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(content.publishedAt)}
                      </span>
                    </div>
                    <a
                      href={content.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-violet-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Visit
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && contents.length > 0 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex gap-1">
            {[currentPage - 1, currentPage, currentPage + 1]
              .filter((p) => p > 0)
              .map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  className="w-10"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={contents.length < 10}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
