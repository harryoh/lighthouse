'use client';

import { useState } from 'react';
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
} from 'lucide-react';

// Mock data
const contents = [
  {
    id: '1',
    title: '정치 개혁 관련 최신 뉴스 업데이트',
    url: 'https://news.example.com/article-1',
    source: 'Naver News',
    author: '김기자',
    publishedAt: '2024-01-15 14:30',
    contentHash: 'a3f4b5c6...',
    preview:
      '최근 정치 개혁에 대한 논의가 활발히 진행되고 있으며, 여야 간의 합의점을 찾기 위한 노력이 계속되고 있습니다...',
    type: 'NEWS',
  },
  {
    id: '2',
    title: '경제 전망: 2024년 상반기 분석',
    url: 'https://blog.example.com/post-2',
    source: 'Daum Blog',
    author: '이블로거',
    publishedAt: '2024-01-15 12:15',
    contentHash: 'b4f5c6d7...',
    preview:
      '2024년 상반기 경제 전망에 대한 전문가들의 의견을 종합해보면, 신중한 낙관론이 우세한 것으로 나타났습니다...',
    type: 'BLOG',
  },
  {
    id: '3',
    title: '시민들의 목소리: 교육 정책에 대한 의견',
    url: 'https://community.example.com/thread-3',
    source: 'DC Inside',
    author: 'anonymous',
    publishedAt: '2024-01-15 10:45',
    contentHash: 'c5f6d7e8...',
    preview:
      '교육 정책에 대한 시민들의 다양한 의견이 온라인 커뮤니티를 통해 활발히 공유되고 있습니다...',
    type: 'COMMUNITY',
  },
  {
    id: '4',
    title: '환경 보호 캠페인 소셜 미디어 반응',
    url: 'https://twitter.com/status/12345',
    source: 'Twitter',
    author: '@eco_warrior',
    publishedAt: '2024-01-15 09:20',
    contentHash: 'd6f7e8f9...',
    preview:
      '환경 보호 캠페인에 대한 소셜 미디어의 반응이 뜨겁습니다. 많은 사용자들이 적극적으로 참여하고 있으며...',
    type: 'SOCIAL',
  },
];

const typeColors: Record<string, string> = {
  NEWS: 'bg-violet-600',
  BLOG: 'bg-blue-600',
  SOCIAL: 'bg-cyan-600',
  COMMUNITY: 'bg-green-600',
};

export default function ContentsPage() {
  const [, setSelectedContent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
              <select className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                <option>All Types</option>
                <option>News</option>
                <option>Blog</option>
                <option>Social</option>
                <option>Community</option>
              </select>
              <select className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                <option>Latest First</option>
                <option>Oldest First</option>
                <option>Most Relevant</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contents Grid */}
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
                          typeColors[content.type]
                        }`}
                      >
                        {content.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {content.source}
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
                  {content.preview}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {content.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {content.publishedAt}
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

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2">
        <Button variant="outline" size="sm">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((page) => (
            <Button
              key={page}
              variant={page === 1 ? 'default' : 'outline'}
              size="sm"
              className="w-10"
            >
              {page}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
